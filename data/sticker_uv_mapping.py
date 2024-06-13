from PIL import Image
import numpy as np
from scipy.ndimage import affine_transform

def uv_map(image: np.ndarray, u1, v1, us, vs) -> np.ndarray:
    uv_image = []
    xs, ys, cs = image.shape
    assert xs == ys, "non square image detected, you might wanna check my xs/ys order is the good one before proceeding!"
    for channel in range(cs):
        signe_us = -1 if us < 0 else 1
        signe_vs = -1 if vs < 0 else 1
        uv_image.append(
            affine_transform(
                image[:,:,channel], [[signe_vs, 0], [0, signe_us]], offset=[v1*xs, u1*ys],
                output_shape=(abs(round(vs*xs)), abs(round(us*ys))), mode='grid-wrap', order=3
            )
        )
    uv_image = np.stack(uv_image, axis=-1)
    return uv_image.astype(np.uint8)

def uv_map_pil(image: Image, u1, v1, us, vs) -> Image:
    return Image.fromarray(
        uv_map(
            np.array(image), u1, v1, us, vs
        )
    )

if __name__ == '__main__':
    base_path = "../Exports/LEGO2KDrive/Content/"
    image = Image.open(base_path + "LEGO/Decorations/Licensed/Ambulance_60330/Ambulance_60330.png")
    for name, (u1, v1, us, vs) in {
        "sidedecor": (0.060546, 1.473698, 0.496463, -0.285902),
        "plate2": (0.538595, 0.078112, 0.546174, 0.129805),
        "hood": (-0.017502, 1.462863, 1.043429, -0.988341),
    }.items():
        uv_map_pil(image, u1, v1, us, vs).save(f'_sticker_{name}.png')
