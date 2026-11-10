package dev.novex.client.core;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * What's playing on the computer, from any app (Spotify, Music, a YouTube tab...), for the Now
 * playing module, with play/pause and skip. macOS only: a small helper library shipped in the jar
 * (tools/now-playing) runs inside /usr/bin/perl, which macOS still lets read the system's Now
 * Playing info. It prints a line of JSON whenever something changes and takes commands on stdin.
 * Started only while the module is on; it ends with the game or when the module is turned off.
 */
public final class NowPlaying {
	public static volatile String title = "", artist = "", app = "";
	public static volatile boolean playing;
	private static volatile double elapsed, duration;
	private static volatile long receivedAt;

	private static Process process;
	private static OutputStream commands;
	private static long nextTry;

	private NowPlaying() {}

	public static boolean supported() {
		return System.getProperty("os.name", "").toLowerCase().contains("mac");
	}

	/** Whether a track or video is loaded (playing or paused). An app with no title is just holding an idle session. */
	public static boolean present() {
		return !title.isEmpty();
	}

	/** Seconds into the track, moving on between updates while playing. */
	public static double position() {
		double at = elapsed;
		if (playing) at += (System.nanoTime() - receivedAt) / 1e9;
		return duration > 0 ? Math.min(at, duration) : at;
	}

	public static double duration() {
		return duration;
	}

	/** Starts or stops the helper to match the module; called every frame, cheap when nothing changes. */
	static synchronized void keep(boolean wanted) {
		if (!supported()) return;
		boolean alive = process != null && isAlive(process);
		if (wanted && !alive && System.currentTimeMillis() >= nextTry) start();
		else if (!wanted && process != null) stop();
	}

	public static void toggle() {
		send("toggle");
		// Shows at once; the helper confirms within half a second.
		elapsed = position();
		receivedAt = System.nanoTime();
		playing = !playing;
	}

	public static void next() {
		send("next");
	}

	public static void previous() {
		send("previous");
	}

	private static synchronized void send(String command) {
		if (commands == null) return;
		try {
			commands.write((command + "\n").getBytes(StandardCharsets.UTF_8));
			commands.flush();
		} catch (Exception e) {
			stop();
		}
	}

	private static void start() {
		// Tries again in a few seconds if this one fails or the helper exits.
		nextTry = System.currentTimeMillis() + 5000;
		try {
			File lib = extract();
			ProcessBuilder pb = new ProcessBuilder("/usr/bin/perl", "-e",
					"use DynaLoader; DynaLoader::dl_load_file($ARGV[0]) or die DynaLoader::dl_error();", lib.getAbsolutePath());
			pb.environment().put("NOVEX_NOW_PLAYING", "1");
			pb.redirectErrorStream(true);
			final Process p = pb.start();
			process = p;
			commands = p.getOutputStream();
			Thread reader = new Thread(new Runnable() {
				public void run() {
					read(p);
				}
			}, "Novex Now Playing");
			reader.setDaemon(true);
			reader.start();
		} catch (Exception e) {
			System.err.println("[Novex] Now playing isn't available: " + e);
			process = null;
			commands = null;
		}
	}

	private static synchronized void stop() {
		if (process != null) process.destroy();
		process = null;
		commands = null;
		title = artist = app = "";
		playing = false;
	}

	private static void read(Process p) {
		try {
			BufferedReader in = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8));
			String line;
			while ((line = in.readLine()) != null) {
				if (!line.startsWith("{")) continue;
				try {
					JsonObject o = new JsonParser().parse(line).getAsJsonObject();
					if (o.has("error")) continue;
					title = o.get("title").getAsString();
					artist = o.get("artist").getAsString();
					app = o.get("app").getAsString();
					playing = o.get("playing").getAsBoolean();
					elapsed = o.get("elapsed").getAsDouble();
					duration = o.get("duration").getAsDouble();
					receivedAt = System.nanoTime();
				} catch (RuntimeException ignored) {
					// A line we don't understand; the next one replaces it.
				}
			}
		} catch (Exception ignored) {
			// The helper ended.
		}
	}

	/** The helper library, copied out of the jar into the temp folder once per game. */
	private static File extract() throws Exception {
		File out = new File(System.getProperty("java.io.tmpdir"), "novex-now-playing-" + NovexCore.ID + ".dylib");
		InputStream in = NowPlaying.class.getResourceAsStream("/novex-now-playing.dylib");
		if (in == null) throw new IllegalStateException("helper missing from the jar");
		try {
			OutputStream o = new FileOutputStream(out);
			try {
				byte[] buf = new byte[16384];
				int n;
				while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
			} finally {
				o.close();
			}
		} finally {
			in.close();
		}
		return out;
	}

	private static boolean isAlive(Process p) {
		try {
			p.exitValue();
			return false;
		} catch (IllegalThreadStateException e) {
			return true;
		}
	}

	/** "1:05" from seconds. */
	public static String time(double seconds) {
		int s = (int) Math.max(0, seconds);
		return s / 60 + ":" + (s % 60 < 10 ? "0" : "") + s % 60;
	}
}
