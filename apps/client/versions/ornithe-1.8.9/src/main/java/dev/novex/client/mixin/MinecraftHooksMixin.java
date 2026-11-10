package dev.novex.client.mixin;

import dev.novex.client.NovexClient;
import net.minecraft.client.Minecraft;
import org.lwjgl.input.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Startup, tick and mouse hooks, which Forge provided as events. */
@Mixin(Minecraft.class)
abstract class MinecraftHooksMixin {
	@Inject(method = "startGame", at = @At("HEAD"))
	private void novex$init(CallbackInfo ci) {
		NovexClient.init();
	}

	@Inject(method = "startGame", at = @At("TAIL"))
	private void novex$started(CallbackInfo ci) {
		NovexClient.started();
	}

	@Inject(method = "runTick", at = @At("TAIL"))
	private void novex$tick(CallbackInfo ci) {
		NovexClient.tick();
	}

	/** Each mouse event while playing; the first setKeyBindState in runTick is the mouse loop's. */
	@Inject(method = "runTick", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/settings/KeyBinding;setKeyBindState(IZ)V", ordinal = 0))
	private void novex$mouse(CallbackInfo ci) {
		NovexClient.mouse(Mouse.getEventButton(), Mouse.getEventButtonState());
	}
}
