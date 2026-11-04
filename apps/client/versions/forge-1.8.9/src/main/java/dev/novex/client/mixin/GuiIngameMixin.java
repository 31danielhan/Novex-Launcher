package dev.novex.client.mixin;

import dev.novex.client.Sidebar;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.gui.GuiIngame;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.scoreboard.ScoreObjective;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Replaces the scoreboard sidebar with Novex's cleaner one. */
@Mixin(GuiIngame.class)
public abstract class GuiIngameMixin {
	@Inject(method = "renderScoreboard", at = @At("HEAD"), cancellable = true)
	private void novex$sidebar(ScoreObjective objective, ScaledResolution res, CallbackInfo ci) {
		if (!NovexCore.config.sidebar) return;
		Sidebar.render(objective, res);
		ci.cancel();
	}
}
