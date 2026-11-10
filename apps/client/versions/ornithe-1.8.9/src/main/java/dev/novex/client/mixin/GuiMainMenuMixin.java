package dev.novex.client.mixin;

import dev.novex.client.NovexClient;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiMainMenu;
import net.minecraft.client.gui.GuiScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** The Novex Client button on the title screen. */
@Mixin(GuiMainMenu.class)
abstract class GuiMainMenuMixin extends GuiScreen {
	@Inject(method = "initGui", at = @At("TAIL"))
	private void novex$button(CallbackInfo ci) {
		NovexClient.titleButtons((GuiMainMenu) (Object) this, buttonList);
	}

	@Inject(method = "actionPerformed", at = @At("HEAD"), cancellable = true)
	private void novex$pressed(GuiButton button, CallbackInfo ci) {
		if (NovexClient.titleButton((GuiMainMenu) (Object) this, button)) ci.cancel();
	}
}
