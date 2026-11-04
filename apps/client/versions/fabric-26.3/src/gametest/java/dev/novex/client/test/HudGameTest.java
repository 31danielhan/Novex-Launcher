package dev.novex.client.test;

import com.mojang.blaze3d.platform.InputConstants;
import dev.novex.client.core.NovexCore;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;

/**
 * Walks through Novex Client: the title screen button and settings, then in a world the HUD, zoom,
 * the HUD editor (dragging an element), the settings from the editor, and motion blur.
 */
public class HudGameTest implements FabricClientGameTest {
	/** A solid skin the launcher would have downloaded for an offline account. */
	private static void writeSkin() {
		try {
			java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(64, 64, java.awt.image.BufferedImage.TYPE_INT_ARGB);
			for (int x = 0; x < 64; x++) for (int y = 0; y < 64; y++) image.setRGB(x, y, 0xFFFF00FF);
			java.nio.file.Path config = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir();
			javax.imageio.ImageIO.write(image, "png", config.resolve("novex-skin.png").toFile());
			java.nio.file.Files.writeString(config.resolve("novex-skin.txt"), "Test\nslim\n");
		} catch (java.io.IOException e) {
			throw new AssertionError(e);
		}
	}

	private static void checkSkin(ClientGameTestContext ctx) {
		check(ctx.computeOnClient(mc -> {
			var skin = mc.player.getSkin();
			return skin.body().texturePath().getPath().equals("offline_skin")
					&& skin.model() == net.minecraft.world.entity.player.PlayerModelType.SLIM;
		}), "The offline skin wasn't applied");
		ctx.runOnClient(mc -> mc.options.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_FRONT));
		ctx.waitTicks(5);
		ctx.takeScreenshot("novex-offline-skin");
		ctx.runOnClient(mc -> mc.options.setCameraType(net.minecraft.client.CameraType.FIRST_PERSON));
		try {
			java.nio.file.Path config = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir();
			java.nio.file.Files.deleteIfExists(config.resolve("novex-skin.png"));
			java.nio.file.Files.deleteIfExists(config.resolve("novex-skin.txt"));
		} catch (java.io.IOException e) {
			throw new AssertionError(e);
		}
	}

	@Override
	public void runTest(ClientGameTestContext ctx) {
		// Title screen: the Novex Client button opens the settings. Buttons ignore clicks while the
		// title screen fades in, so wait that out first.
		ctx.waitTicks(40);
		ctx.takeScreenshot("novex-title");
		// The test's simulated clicks don't reach vanilla title-screen buttons (not even Singleplayer),
		// so find ours and press it directly.
		check(ctx.computeOnClient(mc -> {
			for (var w : net.fabricmc.fabric.api.client.screen.v1.Screens.getWidgets(mc.gui.screen())) {
				if (w instanceof net.minecraft.client.gui.components.Button b && b.getMessage().getString().equals("Novex Client")) {
					b.onPress(new net.minecraft.client.input.KeyEvent(InputConstants.KEY_RETURN, 0, 0));
					return true;
				}
			}
			return false;
		}), "No Novex Client button on the title screen");
		ctx.waitTicks(3);
		ctx.takeScreenshot("novex-settings-title");
		ctx.getInput().pressKey(InputConstants.KEY_ESCAPE);
		ctx.waitTicks(3);
		ctx.takeScreenshot("novex-editor-title");
		ctx.getInput().pressKey(InputConstants.KEY_RSHIFT);
		ctx.waitTicks(3);
		check(ctx.computeOnClient(mc -> mc.gui.screen() instanceof net.minecraft.client.gui.screens.TitleScreen),
				"Right Shift didn't close back to the title screen");

		writeSkin();
		try (TestSingleplayerContext world = ctx.worldBuilder().create()) {
			world.getConnection().waitForChunksRender(true, 1200);
			checkSkin(ctx);
			ctx.getInput().holdKey(o -> o.keyUp);
			ctx.waitTicks(10);
			ctx.takeScreenshot("novex-hud");
			ctx.getInput().releaseKey(o -> o.keyUp);
			ctx.getInput().holdKey(InputConstants.KEY_C);
			ctx.waitTicks(10);
			ctx.takeScreenshot("novex-zoom");
			ctx.getInput().releaseKey(InputConstants.KEY_C);

			// HUD editor: drag the FPS readout to the middle of the right side.
			ctx.getInput().pressKey(InputConstants.KEY_RSHIFT);
			ctx.waitTicks(3);
			ctx.takeScreenshot("novex-editor");
			int[] gui = ctx.computeOnClient(mc -> new int[] {mc.getWindow().getGuiScaledWidth(), mc.getWindow().getGuiScaledHeight()});
			drag(ctx, 12, 6, gui[0] - 60, gui[1] / 2 - 60);
			ctx.takeScreenshot("novex-editor-dragged");
			check(ctx.computeOnClient(mc -> NovexCore.config.hud.containsKey("fps")), "Dragging didn't move the FPS element");

			// The middle button opens the settings; Esc goes back to the editor, Right Shift closes.
			click(ctx, gui[0] / 2, gui[1] / 2);
			ctx.waitTicks(3);
			ctx.takeScreenshot("novex-settings");
			// The first card's Options bar opens its page; Esc goes back to the grid, then the editor.
			ctx.waitTicks(6);
			float ps = Math.min(1f, Math.min((gui[0] - 12f) / 440, (gui[1] - 12f) / 270));
			float px = (gui[0] - 440 * ps) / 2f, py = (gui[1] - 270 * ps) / 2f;
			int cw = (440 - 134 - 14 - 16) / 3;
			click(ctx, px + (134 + cw / 2f) * ps, py + (68 + 73) * ps);
			ctx.waitTicks(3);
			ctx.takeScreenshot("novex-options");
			ctx.getInput().pressKey(InputConstants.KEY_ESCAPE);
			ctx.waitTicks(2);
			ctx.getInput().pressKey(InputConstants.KEY_ESCAPE);
			ctx.waitTicks(2);
			ctx.getInput().pressKey(InputConstants.KEY_RSHIFT);
			ctx.waitTicks(3);
			check(ctx.computeOnClient(mc -> mc.gui.screen()) == null, "Right Shift didn't close the editor");
			ctx.takeScreenshot("novex-hud-moved");

			// Motion blur: tilt the view quickly so the horizon blurs; screenshot on the frame of the last
			// turn, once without blur and once with it.
			for (boolean blur : new boolean[] {false, true}) {
				ctx.runOnClient(mc -> {
					NovexCore.config.motionBlur = blur;
					NovexCore.config.motionBlurLevel = 3;
					mc.player.setXRot(10f);
				});
				ctx.waitTicks(3);
				for (int i = 0; i < 4; i++) {
					ctx.runOnClient(mc -> mc.player.setXRot(mc.player.getXRot() - 4f));
					ctx.waitTicks(1);
				}
				ctx.runOnClient(mc -> mc.player.setXRot(mc.player.getXRot() - 4f));
				ctx.takeScreenshot(blur ? "novex-motion-blur" : "novex-motion-sharp");
			}
			ctx.runOnClient(mc -> {
				NovexCore.config.motionBlur = false;
				NovexCore.config.hud.clear();
			});
		}
	}

	/**
	 * Moves the cursor to a GUI-scaled point. The input API works in window coordinates, which on a
	 * high-density display are smaller than the framebuffer, so scale by window size over GUI size.
	 */
	private static void moveTo(ClientGameTestContext ctx, double x, double y) {
		double scale = ctx.computeOnClient(mc -> (double) mc.getWindow().getScreenWidth() / mc.getWindow().getGuiScaledWidth());
		ctx.getInput().setCursorPos(x * scale, y * scale);
	}

	private static void click(ClientGameTestContext ctx, double x, double y) {
		moveTo(ctx, x, y);
		ctx.waitTicks(1);
		ctx.getInput().pressMouse(0);
	}

	private static void drag(ClientGameTestContext ctx, double x1, double y1, double x2, double y2) {
		moveTo(ctx, x1, y1);
		ctx.waitTicks(1);
		ctx.getInput().holdMouse(0);
		for (int i = 1; i <= 5; i++) {
			moveTo(ctx, x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5);
			ctx.waitTicks(1);
		}
		ctx.getInput().releaseMouse(0);
		ctx.waitTicks(2);
	}

	private static void check(boolean ok, String message) {
		if (!ok) throw new AssertionError(message);
	}
}
