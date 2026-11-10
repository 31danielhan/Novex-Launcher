package dev.novex.client;

import dev.novex.client.core.ClientGui;
import net.minecraft.client.gui.GuiScreen;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

/** Hosts Novex Client's HUD editor and settings, which draw themselves through ClientGui. */
final class NovexScreen extends GuiScreen {
	private final GuiScreen parent;
	private final ClientGui gui;

	/** Novex's own title screen (Custom home page). */
	static NovexScreen home() {
		return new NovexScreen(null, new ClientGui().openHome());
	}

	NovexScreen(GuiScreen parent, boolean settings) {
		this(parent, settings ? new ClientGui().openSettings() : new ClientGui());
	}

	private NovexScreen(GuiScreen parent, ClientGui gui) {
		this.parent = parent;
		this.gui = gui;
	}

	@Override
	public void drawScreen(int mouseX, int mouseY, float partial) {
		// No dirt in a world: the HUD editor shows the game behind it. The home page gets a dark
		// gradient, since 1.8.9's panorama belongs to its own title screen.
		if (gui.isHome()) drawGradientRect(0, 0, width, height, 0xFF0B1016, 0xFF18212B);
		else if (mc.theWorld == null) drawDefaultBackground();
		gui.render(NovexClient.gfx(), NovexClient.GAME, mouseX, mouseY);
		if (gui.done()) close();
		ClientGui.Action action = gui.takeAction();
		if (action != null) home(action);
	}

	@Override
	protected void mouseClicked(int x, int y, int button) {
		gui.mouseDown(NovexClient.gfx(), NovexClient.GAME, x, y, button);
	}

	@Override
	protected void mouseClickMove(int x, int y, int button, long held) {
		gui.mouseDrag(NovexClient.gfx(), NovexClient.GAME, x, y);
	}

	@Override
	protected void mouseReleased(int x, int y, int button) {
		gui.mouseUp();
	}

	/** 1.8.9 screens get the scroll wheel only through raw mouse input. */
	@Override
	public void handleMouseInput() {
		super.handleMouseInput();
		int wheel = Mouse.getEventDWheel();
		if (wheel == 0) return;
		int x = Mouse.getEventX() * width / mc.displayWidth;
		int y = height - Mouse.getEventY() * height / mc.displayHeight - 1;
		gui.scroll(NovexClient.gfx(), NovexClient.GAME, x, y, Math.signum(wheel));
	}

	/** The menu key closes; Esc steps back from the settings to the editor, then closes. */
	@Override
	protected void keyTyped(char c, int key) {
		if (key == NovexClient.menuKey.getKeyCode()) close();
		else if (key == Keyboard.KEY_ESCAPE) {
			if (gui.escape()) close();
		} else if (key == Keyboard.KEY_BACK) gui.backspace();
		else if (c >= ' ') gui.typed(c);
	}

	private void close() {
		mc.displayGuiScreen(parent);
	}

	@Override
	public void onGuiClosed() {
		gui.closed();
	}

	@Override
	public boolean doesGuiPauseGame() {
		return false;
	}

	/** The custom title screen's buttons: the game's own screens, with this one to come back to. */
	private void home(ClientGui.Action action) {
		switch (action) {
			case SINGLEPLAYER: mc.displayGuiScreen(new net.minecraft.client.gui.GuiSelectWorld(this)); break;
			case MULTIPLAYER: mc.displayGuiScreen(new net.minecraft.client.gui.GuiMultiplayer(this)); break;
			case OPTIONS: mc.displayGuiScreen(new net.minecraft.client.gui.GuiOptions(this, mc.gameSettings)); break;
			case QUIT: mc.shutdown(); break;
		}
	}
}
