package dev.novex.client.mixin;

import com.mojang.authlib.GameProfile;
import dev.novex.client.SkinTexture;
import dev.novex.client.core.OfflineSkin;
import net.minecraft.client.network.NetworkPlayerInfo;
import net.minecraft.util.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Puts the launcher's skin on an offline player's own character, in every place it's drawn. */
@Mixin(NetworkPlayerInfo.class)
public abstract class NetworkPlayerInfoMixin {
	@Shadow public abstract GameProfile getGameProfile();

	@Inject(method = "getLocationSkin", at = @At("HEAD"), cancellable = true)
	private void novex$skin(CallbackInfoReturnable<ResourceLocation> cir) {
		if (!SkinTexture.isLocal(getGameProfile().getName())) return;
		ResourceLocation skin = SkinTexture.get();
		if (skin != null) cir.setReturnValue(skin);
	}

	@Inject(method = "getSkinType", at = @At("HEAD"), cancellable = true)
	private void novex$model(CallbackInfoReturnable<String> cir) {
		if (SkinTexture.isLocal(getGameProfile().getName()) && SkinTexture.get() != null) {
			cir.setReturnValue(OfflineSkin.slim() ? "slim" : "default");
		}
	}
}
