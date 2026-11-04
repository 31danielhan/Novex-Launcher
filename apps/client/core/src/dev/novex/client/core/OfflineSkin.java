package dev.novex.client.core;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * The skin the launcher downloaded for an offline account, in the config folder. There's no file
 * for any other account. Adapters show it on the player's own character.
 */
public final class OfflineSkin {
	private static Path dir;
	private static Boolean slim;

	private OfflineSkin() {}

	static void init(Path configDir) {
		dir = configDir;
	}

	/** The PNG, or null if this account has no skin here. */
	public static byte[] image() {
		try {
			return Files.readAllBytes(dir.resolve("novex-skin.png"));
		} catch (IOException e) {
			return null;
		}
	}

	/** Read once: the game asks for this every time it draws the player. */
	public static boolean slim() {
		if (slim == null) {
			try {
				List<String> info = Files.readAllLines(dir.resolve("novex-skin.txt"), StandardCharsets.UTF_8);
				slim = info.size() > 1 && info.get(1).equals("slim");
			} catch (IOException e) {
				slim = false;
			}
		}
		return slim;
	}
}
