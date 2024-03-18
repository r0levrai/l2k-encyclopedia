import numpy as np
from PIL import Image
from scipy import ndimage


base_path = "../Exports/LEGO2KDrive/Content/Game/UI/Textures/4K/"
out_path = "tiles/backgrounds/"
image_paths = {
    base_path + "CreatorsHub/t_CHUB_tile_small.png": out_path + "hub0.png",
    base_path + "CreatorsHub/t_CHUB_tile_special_small.png": out_path + "hub1.png",
    base_path + "Loadout/t_loadout_tile_rarity0.png": out_path + "rarity0.png",
    base_path + "Loadout/t_loadout_tile_rarity1.png": out_path + "rarity1.png",
    base_path + "Loadout/t_loadout_tile_rarity2.png": out_path + "rarity2.png",
    base_path + "Loadout/t_loadout_tile_rarity3.png": out_path + "rarity3.png",
    base_path + "Loadout/t_loadout_tile_disabled.png": out_path + "disabled.png",
}
skew_degrees = -10
crop_x = (547, 547+472)
crop_y = (295, 295+433)

for skewed_image_path, unskewed_image_path in image_paths.items():
    skewed_image = np.array(Image.open(skewed_image_path))
    height, width, colors = skewed_image.shape
    xyratio = np.tan(skew_degrees*2*np.pi/360)
    transform = [[1, 0, 0],
                 [xyratio, 1, 0],
                 [0, 0, 1]]
    unskewed_image = ndimage.affine_transform(skewed_image,
                                             transform,
                                             offset=(0, height*xyratio, 0),
                                             output_shape=(height, width+height//2, colors))
    cropped_image = unskewed_image[crop_y[0]:crop_y[1], crop_x[0]:crop_x[1]]
    print(skewed_image.shape, unskewed_image.shape, cropped_image.shape, sep=' -> ')
    Image.fromarray(cropped_image).save(unskewed_image_path)