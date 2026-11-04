package dev.novex.client;

import dev.novex.client.core.NovexCore;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.scoreboard.Score;
import net.minecraft.scoreboard.ScoreObjective;
import net.minecraft.scoreboard.ScorePlayerTeam;
import net.minecraft.scoreboard.Scoreboard;

/**
 * The scoreboard sidebar servers like Hypixel use for game info, drawn on one soft panel with text
 * shadow. The red score numbers are hidden unless turned on; servers use them only for ordering.
 */
public final class Sidebar {
	private static final int PANEL = 0x55000000;
	private static final int TITLE = 0x33000000;
	private static final int NUMBER = 0xFFFF5555;
	private static final int MAX_LINES = 15;

	public static void render(ScoreObjective objective, ScaledResolution res) {
		FontRenderer font = Minecraft.getMinecraft().fontRendererObj;
		Scoreboard board = objective.getScoreboard();
		boolean numbers = NovexCore.config.sidebarNumbers;

		// Same lines as vanilla: hidden "#" entries dropped, the last 15 kept, lowest score at the bottom.
		List<Score> lines = new ArrayList<Score>();
		for (Score s : board.getSortedScores(objective))
			if (s.getPlayerName() != null && !s.getPlayerName().startsWith("#")) lines.add(s);
		if (lines.size() > MAX_LINES) lines = lines.subList(lines.size() - MAX_LINES, lines.size());

		String title = objective.getDisplayName();
		int width = font.getStringWidth(title);
		List<String> names = new ArrayList<String>();
		for (Score s : lines) {
			String name = ScorePlayerTeam.formatPlayerName(board.getPlayersTeam(s.getPlayerName()), s.getPlayerName());
			names.add(name);
			int w = font.getStringWidth(name) + (numbers ? font.getStringWidth(" " + s.getScorePoints()) : 0);
			width = Math.max(width, w);
		}

		int lh = font.FONT_HEIGHT;
		int right = res.getScaledWidth() - 3;
		int left = right - width;
		int bottom = res.getScaledHeight() / 2 + lines.size() * lh / 3;
		int top = bottom - lines.size() * lh - lh - 2;

		Gui.drawRect(left - 3, top - 1, right + 2, bottom + 1, PANEL);
		Gui.drawRect(left - 3, top - 1, right + 2, top + lh + 1, TITLE);
		font.drawString(title, left + (width - font.getStringWidth(title)) / 2, top, 0xFFFFFFFF, true);

		// Scores come lowest first, and the lowest is drawn at the bottom.
		int i = 0;
		for (Score s : lines) {
			int y = bottom - (i + 1) * lh;
			font.drawString(names.get(i), left, y, 0xFFFFFFFF, true);
			if (numbers) {
				String n = String.valueOf(s.getScorePoints());
				font.drawString(n, right - font.getStringWidth(n), y, NUMBER, true);
			}
			i++;
		}
	}
}
