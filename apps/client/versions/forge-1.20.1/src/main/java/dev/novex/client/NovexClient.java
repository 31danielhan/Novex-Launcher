package dev.novex.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.novex.client.core.Clicks;
import dev.novex.client.core.Game;
import dev.novex.client.core.Gfx;
import dev.novex.client.core.Hud;
import dev.novex.client.core.Module;
import dev.novex.client.core.NovexCore;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ChatScreen;
import net.minecraft.client.gui.components.Button;
import net.minecraftforge.client.event.ScreenEvent;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.client.event.InputEvent;
import net.minecraftforge.client.event.RegisterGuiOverlaysEvent;
import net.minecraftforge.client.event.RegisterKeyMappingsEvent;
import net.minecraftforge.client.event.ViewportEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.fml.loading.FMLEnvironment;
import net.minecraftforge.fml.loading.FMLPaths;

/** Minecraft 1.20.1 on Forge. Forge's own events cover input, FOV and HUD overlays, so no mixins. */
@Mod("novex_client")
public final class NovexClient {
	private static final String CATEGORY = "key.category.novex-client.main";
	private static final EquipmentSlot[] SLOTS = {
		EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND
	};
	static final KeyMapping menuKey = new KeyMapping("key.novex-client.menu", InputConstants.KEY_RSHIFT, CATEGORY);
	private static final KeyMapping zoomKey = new KeyMapping("key.novex-client.zoom", InputConstants.KEY_C, CATEGORY);
	private static boolean smoothBeforeZoom;
	private static boolean applied;

	public NovexClient() {
		// Client-only mod: do nothing if a server loads it by mistake.
		if (!FMLEnvironment.dist.isClient()) return;
		NovexCore.init(FMLPaths.CONFIGDIR.get());
		NovexCore.modules = Module.WITH_BLUR;
		NovexCore.onChange = () -> apply(Minecraft.getInstance());
		MinecraftForge.EVENT_BUS.addListener((ScreenEvent.Init.Post e) -> {
			Screen screen = e.getScreen();
			Minecraft mc = Minecraft.getInstance();
			int width = screen.width, height = screen.height;
			// A Novex Client button on the title screen, above Singleplayer.
			if (screen instanceof TitleScreen && NovexCore.config.titleButton) e.addListener(Button.builder(Component.literal("Novex Client"),
						b -> mc.setScreen(new NovexScreen(screen, true)))
						.bounds(width / 2 - 100, height / 4 + 24, 200, 20).build());
		});
		// The menu key opens the editor from any other screen too (menus, inventories, pause).
		MinecraftForge.EVENT_BUS.addListener((ScreenEvent.KeyPressed.Post e) -> {
			Screen s = e.getScreen();
			if (menuKey.matches(e.getKeyCode(), e.getScanCode()) && !(s instanceof NovexScreen) && !(s instanceof ChatScreen))
				Minecraft.getInstance().setScreen(new NovexScreen(s, false));
		});
		IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
		modBus.addListener((RegisterKeyMappingsEvent e) -> {
			e.register(menuKey);
			e.register(zoomKey);
		});
		modBus.addListener((RegisterGuiOverlaysEvent e) ->
				e.registerAboveAll("hud", (gui, g, partial, w, h) -> Hud.draw(gfx(g), GAME)));
		MinecraftForge.EVENT_BUS.addListener((TickEvent.ClientTickEvent e) -> {
			if (e.phase == TickEvent.Phase.END) tick(Minecraft.getInstance());
		});
		MinecraftForge.EVENT_BUS.addListener((InputEvent.MouseButton.Pre e) -> {
			if (e.getAction() == InputConstants.PRESS && Minecraft.getInstance().screen == null) Clicks.press(e.getButton());
		});
		MinecraftForge.EVENT_BUS.addListener(
				(ViewportEvent.ComputeFov e) -> e.setFOV(NovexCore.zoomedFov((float) e.getFOV())));
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
				g.pose().pushPose();
				g.pose().translate(x, y, 0);
				g.pose().scale(scale, scale, 1);
			}

			public void pop() { g.pose().popPose(); }

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
			net.minecraft.resources.ResourceLocation rl = net.minecraft.resources.ResourceLocation.tryParse(id);
			stack = rl == null ? ItemStack.EMPTY : new ItemStack(net.minecraft.core.registries.BuiltInRegistries.ITEM.get(rl));
			ICONS.put(id, stack);
		}
		return stack;
	}

	static final Game GAME = new Game() {
		private Minecraft mc() { return Minecraft.getInstance(); }

		public boolean active() { return mc().player != null && !mc().options.renderDebug; }
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
				out.add(new Effect(e.getEffect().getDisplayName().getString(), e.getAmplifier(),
						e.getDuration(), e.isInfiniteDuration()));
			return out;
		}

		public int blocksToBuildLimit() { return -1; }
	};
}
