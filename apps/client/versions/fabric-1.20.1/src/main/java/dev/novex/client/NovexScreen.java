package dev.novex.client;

import dev.novex.client.core.ClientGui;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Hosts Novex Client's HUD editor and settings, which draw themselves through ClientGui. */
final class NovexScreen extends Screen {
	private final Screen parent;
	private final ClientGui gui;

	NovexScreen(Screen parent, boolean settings) {
		super(Component.literal("Novex Client"));
		this.parent = parent;
		this.gui = settings ? new ClientGui().openSettings() : new ClientGui();
	}

	@Override
	public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
		// No blur or dirt: the HUD editor shows the game behind it.
		if (minecraft.level == null) renderBackground(g);
		gui.render(NovexClient.gfx(g), NovexClient.GAME, mouseX, mouseY);
	}


	@Override
	public boolean mouseClicked(double x, double y, int button) {
		gui.mouseDown(gfx(), NovexClient.GAME, x, y, button);
		return true;
	}

	@Override
	public boolean mouseDragged(double x, double y, int button, double dx, double dy) {
		gui.mouseDrag(gfx(), NovexClient.GAME, x, y);
		return true;
	}

	@Override
	public boolean mouseReleased(double x, double y, int button) {
		gui.mouseUp();
		return true;
	}

	@Override
	public boolean mouseScrolled(double x, double y, double amount) {
		gui.scroll(gfx(), NovexClient.GAME, x, y, amount);
		return true;
	}

	/** The menu key closes from anywhere. */
	@Override
	public boolean keyPressed(int key, int scancode, int modifiers) {
		if (NovexClient.menuKey.matches(key, scancode)) {
			close();
			return true;
		}
		if (key == 259) {
			gui.backspace();
			return true;
		}
		return super.keyPressed(key, scancode, modifiers);
	}

	@Override
	public boolean charTyped(char c, int modifiers) {
		gui.typed(c);
		return true;
	}

	/** Esc: steps back from the settings to the editor, and closes from the editor. */
	@Override
	public void onClose() {
		if (gui.escape()) close();
	}

	private void close() {
		gui.closed();
		Minecraft.getInstance().setScreen(parent);
	}

	@Override
	public void removed() {
		gui.closed();
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	/** Mouse handlers get no graphics object, so measure with a stand-in of the same size. */
	private dev.novex.client.core.Gfx gfx() {
		return NovexClient.measure(width, height);
	}
}
