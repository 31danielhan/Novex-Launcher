package dev.novex.client;

import net.minecraft.client.Minecraft;
import net.minecraft.util.ScreenShotHelper;
import net.minecraft.world.WorldSettings;
import net.minecraft.world.WorldType;
import org.lwjgl.opengl.Display;

/**
 * A scripted run for checking a build without a person at the keyboard. Only active when the game
 * starts with -Dnovex.selftest=1: it screenshots the title screen and the menu, opens a flat
 * creative world with the frame rate uncapped, logs the frame rate each second, screenshots the
 * HUD and the menu in the world, switches motion blur on mid-game while turning the camera and off
 * again (screenshotting each, the way a player toggles it from the menu), then quits. Screenshots land in the game folder's screenshots/.
 */
public final class SelfTest {
	public static final boolean ON = System.getProperty("novex.selftest") != null;
	private static int ticks, inWorld;
	private static boolean blurBefore;

	private SelfTest() {}

	static void tick() {
		if (!ON) return;
		Minecraft mc = Minecraft.getMinecraft();
		ticks++;
		if (mc.theWorld == null) {
			if (ticks == 60) {
				shot(mc, "novex-title");
				net.minecraft.client.gui.ScaledResolution res = new net.minecraft.client.gui.ScaledResolution(mc);
				System.out.println("[Novex selftest] screen " + mc.displayWidth + "x" + mc.displayHeight + " window "
						+ Display.getWidth() + "x" + Display.getHeight() + " pixelScale " + PixelScale.get()
						+ " guiScale " + mc.gameSettings.guiScale + " -> " + res.getScaleFactor());
			}
			if (ticks == 70) mc.displayGuiScreen(new NovexScreen(mc.currentScreen, true));
			if (ticks == 90) shot(mc, "novex-menu");
			if (ticks == 100) {
				mc.displayGuiScreen(null);
				mc.gameSettings.limitFramerate = 260;
				mc.gameSettings.enableVsync = false;
				// The window is in the background during a self-test; measure it as if it were in front.
				mc.gameSettings.pauseOnLostFocus = false;
				Display.setVSyncEnabled(false);
				mc.launchIntegratedServer("novex-selftest", "novex-selftest",
						new WorldSettings(1L, WorldSettings.GameType.CREATIVE, false, false, WorldType.FLAT));
			}
			return;
		}
		inWorld++;
		if (inWorld % 20 == 0) System.out.println("[Novex selftest] fps " + Minecraft.getDebugFPS());
		if (inWorld == 200) shot(mc, "novex-hud");
		if (inWorld == 210) mc.displayGuiScreen(new NovexScreen(null, true));
		if (inWorld == 230) shot(mc, "novex-menu-world");
		if (inWorld == 240) mc.displayGuiScreen(new NovexScreen(null, false));
		if (inWorld == 246) shot(mc, "novex-editor");
		if (inWorld == 248) mc.displayGuiScreen(null);
		// Midnight, where lighting problems (and Fullbright) show.
		if (inWorld == 250 && mc.getIntegratedServer() != null) {
			for (net.minecraft.world.WorldServer w : mc.getIntegratedServer().worldServers) w.setWorldTime(18000L);
		}
		if (inWorld == 260) {
			blurBefore = dev.novex.client.core.NovexCore.config.motionBlur;
			// -Dnovex.selftest.noblur=true keeps it off, for comparing against the same moments without it.
			dev.novex.client.core.NovexCore.config.motionBlur = !Boolean.getBoolean("novex.selftest.noblur");
		}
		// Turning, so the blur has motion to show; still again for the screenshots.
		if (inWorld > 260 && inWorld < 290 || inWorld > 300 && inWorld < 320) mc.thePlayer.rotationYaw += 3f;
		if (inWorld == 296) shot(mc, "novex-blur-on");
		if (inWorld == 320) dev.novex.client.core.NovexCore.config.motionBlur = false;
		if (inWorld == 340) shot(mc, "novex-blur-off");
		if (inWorld == 341) dev.novex.client.core.NovexCore.config.motionBlur = blurBefore;
		if (inWorld == 400) {
			System.out.println("[Novex selftest] done");
			mc.shutdown();
		}
	}

	private static void shot(Minecraft mc, String name) {
		ScreenShotHelper.saveScreenshot(mc.mcDataDir, name + ".png", mc.displayWidth, mc.displayHeight, mc.getFramebuffer());
		System.out.println("[Novex selftest] screenshot " + name);
	}
}
