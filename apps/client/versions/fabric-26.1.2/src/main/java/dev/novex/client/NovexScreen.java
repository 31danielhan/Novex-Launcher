package dev.novex.client;

import dev.novex.client.core.ClientGui;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
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
		super(Component.literal(dev.novex.client.core.Lang.tr("Novex Client")));
		this.parent = parent;
		this.gui = gui;
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partial) {
		gui.render(NovexClient.gfx(g), NovexClient.GAME, mouseX, mouseY);
		if (gui.done()) close();
		ClientGui.Action action = gui.takeAction();
		if (action != null) home(action);
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partial) {
		// No blur or dirt: the HUD editor shows the game behind it.
		if (minecraft.level == null) super.extractBackground(g, mouseX, mouseY, partial);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean doubleClick) {
		gui.mouseDown(gfx(), NovexClient.GAME, e.x(), e.y(), e.button());
		return true;
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) {
		gui.mouseDrag(gfx(), NovexClient.GAME, e.x(), e.y());
		return true;
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent e) {
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
	public boolean keyPressed(KeyEvent event) {
		if (NovexClient.menuKey.matches(event)) {
			close();
			return true;
		}
		if (event.key() == 259) {
			gui.backspace();
			return true;
		}
		return super.keyPressed(event);
	}

	@Override
	public boolean charTyped(CharacterEvent event) {
		if (Character.isBmpCodePoint(event.codepoint())) gui.typed((char) event.codepoint());
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
			case OPTIONS: mc.setScreen(new net.minecraft.client.gui.screens.options.OptionsScreen(this, mc.options, false)); break;
			case QUIT: mc.stop(); break;
		}
	}

	/** Mouse handlers get no graphics object, so measure with a stand-in of the same size. */
	private dev.novex.client.core.Gfx gfx() {
		return NovexClient.measure(width, height);
	}
}
