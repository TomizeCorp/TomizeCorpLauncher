package fr.tomizecorp.epsilon;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.entity.player.PlayerSkinType;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.util.AssetInfo;
import net.minecraft.util.Identifier;

public final class EpsilonSkin {
    private static final Identifier ID = Identifier.of("epsilon", "local_player_skin");
    private static SkinTextures textures;
    private static boolean attempted;

    private EpsilonSkin() {}

    public static SkinTextures get(String playerName) {
        String expected = System.getProperty("epsilon.username", "");
        String skinPath = System.getProperty("epsilon.skin", "");
        if (skinPath.isBlank() || !expected.equalsIgnoreCase(playerName)) return null;
        if (!attempted) {
            attempted = true;
            try (InputStream stream = Files.newInputStream(Path.of(skinPath))) {
                NativeImage image = NativeImage.read(stream);
                if (image.getWidth() != 64 || (image.getHeight() != 64 && image.getHeight() != 32)) {
                    image.close(); return null;
                }
                MinecraftClient.getInstance().getTextureManager().registerTexture(ID, new NativeImageBackedTexture(() -> "EPSILON local skin", image));
                AssetInfo.TextureAsset body = new AssetInfo.TextureAssetInfo(ID, ID);
                textures = SkinTextures.create(body, null, null, PlayerSkinType.WIDE);
            } catch (Exception ignored) { }
        }
        return textures;
    }
}
