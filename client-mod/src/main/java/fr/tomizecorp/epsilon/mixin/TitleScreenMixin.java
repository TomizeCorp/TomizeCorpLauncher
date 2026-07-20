package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import java.util.Map;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.CookieStorage;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin extends Screen {
    protected TitleScreenMixin(Text title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"))
    private void epsilon$lockMenu(CallbackInfo ci) {
        clearChildren();
        int left = width / 2 - 100;
        int top = height / 2;
        addDrawableChild(ButtonWidget.builder(Text.literal("LANCER EPSILON"), button -> epsilon$connect()).dimensions(left, top, 200, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("QUITTER"), button -> MinecraftClient.getInstance().scheduleStop()).dimensions(left, top + 28, 200, 20).build());
    }

    private void epsilon$connect() {
        MinecraftClient client = MinecraftClient.getInstance();
        ServerAddress address = ServerAddress.parse(EpsilonBranding.SERVER);
        ServerInfo info = new ServerInfo("EPSILON", EpsilonBranding.SERVER, ServerInfo.ServerType.OTHER);
        ConnectScreen.connect(this, client, address, info, true, new CookieStorage(Map.of(), Map.of(), false));
    }
}
