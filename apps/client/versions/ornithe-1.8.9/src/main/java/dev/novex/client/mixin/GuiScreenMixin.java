package dev.novex.client.mixin;

import dev.novex.client.NovexClient;
import net.minecraft.client.gui.GuiScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** The menu key works on any screen. */
@Mixin(GuiScreen.class)
abstract class GuiScreenMixin {
	@Inject(method = "handleKeyboardInput", at = @At("TAIL"))
	private void novex$menuKey(CallbackInfo ci) {
		NovexClient.screenKey((GuiScreen) (Object) this);
	}
}
