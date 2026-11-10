package dev.novex.client.mixin;

import dev.novex.client.NovexClient;
import java.io.File;
import net.minecraft.client.Minecraft;
import net.minecraft.client.settings.GameSettings;
import net.minecraft.client.settings.KeyBinding;
import org.apache.commons.lang3.ArrayUtils;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Adds Novex's keys to the controls list before options.txt loads, so their bindings are saved. */
@Mixin(GameSettings.class)
abstract class GameSettingsMixin {
	@Shadow public KeyBinding[] keyBindings;

	@Inject(method = "<init>(Lnet/minecraft/client/Minecraft;Ljava/io/File;)V",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/settings/GameSettings;loadOptions()V"))
	private void novex$keys(Minecraft mc, File dir, CallbackInfo ci) {
		keyBindings = ArrayUtils.addAll(keyBindings, NovexClient.keys());
	}
}
