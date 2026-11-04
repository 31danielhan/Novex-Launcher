package dev.novex.client.mixin;

import dev.novex.client.core.Clicks;
import net.minecraft.client.Minecraft;
import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Counts presses for CPS. Only observes input; never adds or changes clicks. */
@Mixin(MouseHandler.class)
abstract class MouseHandlerMixin {
	@Inject(method = "onPress", at = @At("HEAD"))
	private void novex$countClick(long window, int button, int action, int mods, CallbackInfo ci) {
		if (action == 1 && Minecraft.getInstance().screen == null) Clicks.press(button);
	}
}
