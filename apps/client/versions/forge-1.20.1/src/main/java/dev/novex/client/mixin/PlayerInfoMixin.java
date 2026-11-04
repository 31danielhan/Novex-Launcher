package dev.novex.client.mixin;

import com.mojang.authlib.GameProfile;
import dev.novex.client.SkinTexture;
import dev.novex.client.core.OfflineSkin;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.client.multiplayer.PlayerInfo;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Puts the launcher's skin on an offline player's own character, in every place it's drawn. */
@Mixin(PlayerInfo.class)
abstract class PlayerInfoMixin {
	@Shadow @Final private GameProfile profile;

	@Inject(method = "getSkinLocation", at = @At("HEAD"), cancellable = true)
	private void novex$skin(CallbackInfoReturnable<ResourceLocation> cir) {
		if (!SkinTexture.isLocal(profile.getName())) return;
		ResourceLocation skin = SkinTexture.get();
		if (skin != null) cir.setReturnValue(skin);
	}

	@Inject(method = "getModelName", at = @At("HEAD"), cancellable = true)
	private void novex$model(CallbackInfoReturnable<String> cir) {
		if (SkinTexture.isLocal(profile.getName()) && SkinTexture.get() != null) {
			cir.setReturnValue(OfflineSkin.slim() ? "slim" : "default");
		}
	}
}
