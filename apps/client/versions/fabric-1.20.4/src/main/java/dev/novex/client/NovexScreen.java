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

	/** Novex's own title screen (Custom home page). */
	static NovexScreen home() {
		return new NovexScreen(null, new ClientGui().openHome());
	}

	NovexScreen(Screen parent, boolean settings) {
		this(parent, settings ? new ClientGui().openSettings() : new ClientGui());
	}

	private NovexScreen(Screen parent, ClientGui gui) {
		super(Component.literal("Novex Client"));
		this.parent = parent;
		this.gui = gui;
	}

	@Override
	public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
		// No blur or dirt: the HUD editor shows the game behind it.
		if (minecraft.level == null) renderBackground(g, mouseX, mouseY, partial);
		gui.render(NovexClient.gfx(g), NovexClient.GAME, mouseX, mouseY);
		if (gui.done()) close();
		ClientGui.Action action = gui.takeAction();
		if (action != null) home(action);
	}

	@Override
	public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partial) {
		if (minecraft.level == null) super.renderBackground(g, mouseX, mouseY, partial);
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
	public boolean mouseScrolled(double x, double y, double dx, double dy) {
		gui.scroll(gfx(), NovexClient.GAME, x, y, dy);
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

	/** The custom title screen's buttons: the game's own screens, with this one to come back to. */
	private void home(ClientGui.Action action) {
		Minecraft mc = Minecraft.getInstance();
		switch (action) {
			case SINGLEPLAYER: mc.setScreen(new net.minecraft.client.gui.screens.worldselection.SelectWorldScreen(this)); break;
			case MULTIPLAYER: mc.setScreen(new net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen(this)); break;
			case OPTIONS: mc.setScreen(new net.minecraft.client.gui.screens.OptionsScreen(this, mc.options)); break;
			case QUIT: mc.stop(); break;
		}
	}

	/** Mouse handlers get no graphics object, so measure with a stand-in of the same size. */
	private dev.novex.client.core.Gfx gfx() {
		return NovexClient.measure(width, height);
	}
}
