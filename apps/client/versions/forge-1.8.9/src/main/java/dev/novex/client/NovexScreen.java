package dev.novex.client;

import dev.novex.client.core.ClientGui;
import java.io.IOException;
import net.minecraft.client.gui.GuiScreen;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

/** Hosts Novex Client's HUD editor and settings, which draw themselves through ClientGui. */
final class NovexScreen extends GuiScreen {
	private final GuiScreen parent;
	private final ClientGui gui;

	NovexScreen(GuiScreen parent, boolean settings) {
		this.parent = parent;
		this.gui = settings ? new ClientGui().openSettings() : new ClientGui();
	}

	@Override
	public void drawScreen(int mouseX, int mouseY, float partial) {
		// No dirt in a world: the HUD editor shows the game behind it.
		if (mc.theWorld == null) drawDefaultBackground();
		gui.render(NovexClient.gfx(), NovexClient.GAME, mouseX, mouseY);
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
	public void handleMouseInput() throws IOException {
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
}
