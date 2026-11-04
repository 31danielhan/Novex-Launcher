package dev.novex.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.novex.client.core.Game;
import dev.novex.client.core.Gfx;
import dev.novex.client.core.Hud;
import dev.novex.client.core.Module;
import dev.novex.client.core.NovexCore;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.ScreenKeyboardEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.resources.Identifier;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;

/** Minecraft 1.21.11 on Fabric. */
public final class NovexClient implements ClientModInitializer {
	private static final KeyMapping.Category CATEGORY =
			KeyMapping.Category.register(Identifier.fromNamespaceAndPath(NovexCore.ID, "main"));
	private static final EquipmentSlot[] SLOTS = {
		EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND
	};
	static KeyMapping menuKey;
	private static KeyMapping zoomKey;
	private static boolean smoothBeforeZoom;
	private static boolean applied;

	@Override
	public void onInitializeClient() {
		NovexCore.init(FabricLoader.getInstance().getConfigDir());
		NovexCore.modules = Module.WITH_BLUR;
		menuKey = KeyBindingHelper.registerKeyBinding(
				new KeyMapping("key.novex-client.menu", InputConstants.KEY_RSHIFT, CATEGORY));
		zoomKey = KeyBindingHelper.registerKeyBinding(
				new KeyMapping("key.novex-client.zoom", InputConstants.KEY_C, CATEGORY));
		HudElementRegistry.addLast(
				Identifier.fromNamespaceAndPath(NovexCore.ID, "hud"), (g, delta) -> Hud.draw(gfx(g), GAME));
		ClientTickEvents.END_CLIENT_TICK.register(NovexClient::tick);
		NovexCore.onChange = () -> apply(Minecraft.getInstance());
		ScreenEvents.AFTER_INIT.register((mc, screen, width, height) -> {
			if (screen instanceof NovexScreen) return;
			// A Novex Client button on the title screen, above Singleplayer.
			if (screen instanceof TitleScreen && NovexCore.config.titleButton)
				Screens.getButtons(screen).add(Button.builder(Component.literal("Novex Client"),
						b -> mc.setScreen(new NovexScreen(screen, true)))
						.bounds(width / 2 - 100, height / 4 + 24, 200, 20).build());
			// The menu key opens the editor from any other screen too (menus, inventories, pause).
			ScreenKeyboardEvents.afterKeyPress(screen).register((s, key) -> {
				if (menuKey.matches(key) && !(s instanceof ChatScreen)) mc.setScreen(new NovexScreen(s, false));
			});
		});
	}

	/** Puts settings that vanilla already has (toggle sprint) into the game's options. */
	static void apply(Minecraft mc) {
		if (mc.options.toggleSprint().get() != NovexCore.config.toggleSprint)
			mc.options.toggleSprint().set(NovexCore.config.toggleSprint);
	}

	private static void tick(Minecraft mc) {
		if (!applied) {
			apply(mc);
			applied = true;
		}
		while (menuKey.consumeClick()) mc.setScreen(new NovexScreen(mc.screen, false));

		// Smooth camera while zoomed, like a spyglass; put the player's own choice back afterwards.
		boolean z = NovexCore.config.zoom && zoomKey.isDown() && mc.screen == null;
		if (z && !NovexCore.zooming) {
			smoothBeforeZoom = mc.options.smoothCamera;
			mc.options.smoothCamera = true;
		} else if (!z && NovexCore.zooming) {
			mc.options.smoothCamera = smoothBeforeZoom;
		}
		NovexCore.zooming = z;
	}

	static Gfx gfx(GuiGraphics g) {
		Minecraft mc = Minecraft.getInstance();
		return new Gfx() {
			public int width() { return g.guiWidth(); }
			public int height() { return g.guiHeight(); }
			public void fill(int x1, int y1, int x2, int y2, int color) { g.fill(x1, y1, x2, y2, color); }
			public void text(String s, int x, int y, int color, boolean shadow) { g.drawString(mc.font, s, x, y, color, shadow); }
			public int textWidth(String s) { return mc.font.width(s); }
			public int lineHeight() { return mc.font.lineHeight; }
			public void item(Object stack, int x, int y) { g.renderItem((ItemStack) stack, x, y); }

			public void push(float x, float y, float scale) {
				g.pose().pushMatrix();
				g.pose().translate(x, y);
				g.pose().scale(scale, scale);
			}

			public void pop() { g.pose().popMatrix(); }

			public boolean icon(String id, int x, int y) {
				try {
					ItemStack stack = NovexClient.icon(id);
					if (stack.isEmpty()) return false;
					g.renderItem(stack, x, y);
					return true;
				} catch (RuntimeException e) {
					// Items can't be made before their components are bound (title screen on 1.20.5+).
					return false;
				}
			}

			public void clip(int x1, int y1, int x2, int y2) { g.enableScissor(x1, y1, x2, y2); }

			public void noClip() { g.disableScissor(); }
		};
	}


	/** Sizes only, for mouse handling outside a frame. */
	static Gfx measure(int width, int height) {
		Minecraft mc = Minecraft.getInstance();
		return new Gfx() {
			public int width() { return width; }
			public int height() { return height; }
			public void fill(int x1, int y1, int x2, int y2, int color) {}
			public void text(String s, int x, int y, int color, boolean shadow) {}
			public int textWidth(String s) { return mc.font.width(s); }
			public int lineHeight() { return mc.font.lineHeight; }
			public void item(Object stack, int x, int y) {}
			public void push(float x, float y, float scale) {}
			public void pop() {}
			public boolean icon(String id, int x, int y) { return false; }
			public void clip(int x1, int y1, int x2, int y2) {}
			public void noClip() {}
		};
	}


	private static final java.util.Map<String, ItemStack> ICONS = new java.util.HashMap<>();

	/**
	 * Item stacks for module icons, by id; empty when this version has no such item. Only kept once
	 * made, since making one fails before item components are bound.
	 */
	static ItemStack icon(String id) {
		ItemStack stack = ICONS.get(id);
		if (stack == null) {
			net.minecraft.resources.Identifier rl = net.minecraft.resources.Identifier.tryParse(id);
			stack = rl == null ? ItemStack.EMPTY : new ItemStack(net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(rl));
			ICONS.put(id, stack);
		}
		return stack;
	}

	static final Game GAME = new Game() {
		private Minecraft mc() { return Minecraft.getInstance(); }

		public boolean active() { return mc().player != null && !mc().getDebugOverlay().showDebugScreen(); }
		public int fps() { return mc().getFps(); }

		public int ping() {
			Minecraft mc = mc();
			if (mc.isLocalServer() || mc.getConnection() == null) return -1;
			PlayerInfo info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
			return info == null ? -1 : info.getLatency();
		}

		public double x() { return mc().player.getX(); }
		public double y() { return mc().player.getY(); }
		public double z() { return mc().player.getZ(); }
		public String facing() { return mc().player.getDirection().getName(); }

		public boolean down(Key key) {
			var o = mc().options;
			return switch (key) {
				case UP -> o.keyUp.isDown();
				case LEFT -> o.keyLeft.isDown();
				case DOWN -> o.keyDown.isDown();
				case RIGHT -> o.keyRight.isDown();
				case JUMP -> o.keyJump.isDown();
				case ATTACK -> o.keyAttack.isDown();
				case USE -> o.keyUse.isDown();
			};
		}

		public List<Piece> armor() {
			List<Piece> out = new ArrayList<>();
			for (EquipmentSlot slot : SLOTS) {
				ItemStack s = mc().player.getItemBySlot(slot);
				if (!s.isEmpty())
					out.add(Hud.piece(s, s.isDamageableItem(), s.getMaxDamage(), s.getDamageValue(), s.getCount()));
			}
			return out;
		}

		public List<Effect> effects() {
			List<Effect> out = new ArrayList<>();
			for (MobEffectInstance e : mc().player.getActiveEffects())
				out.add(new Effect(e.getEffect().value().getDisplayName().getString(), e.getAmplifier(),
						e.getDuration(), e.isInfiniteDuration()));
			return out;
		}

		public int blocksToBuildLimit() { return -1; }
	};
}
