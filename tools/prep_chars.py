#!/usr/bin/env python3
"""Prépare les personnages 3D du jeu à partir du pack « Universal Base Characters [Standard] » de Quaternius (CC0).

  python3 tools/prep_chars.py "<dossier du pack>/Universal Base Characters[Standard]" assets/chars

Produit des .glb autonomes et légers (textures réduites, cartes inutiles au rendu « cel-shading » retirées) :
  body_m.glb               corps rigé (65 os) + yeux + sourcils  (body_f.glb avec --female)
  hair.glb                 coiffures et barbe (maillages rigides : on les accroche à l'os de la tête)
Le pack est téléchargeable gratuitement sur https://quaternius.com/packs/universalbasecharacters.html (licence CC0).
"""
import io, json, struct, sys, os
from array import array
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]  # option : --female pour aussi produire body_f.glb
BODY_DIR = os.path.join(SRC, 'Base Characters', 'Godot - UE')
HAIR_DIR = os.path.join(SRC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')
TEX_DIR = os.path.join(SRC, 'Base Characters', 'Textures')
os.makedirs(OUT, exist_ok=True)


def jpeg(path, size, q=86):
    im = Image.open(path).convert('RGB').resize((size, size), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); return b.getvalue(), 'image/jpeg'


def png(path, size):
    im = Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue(), 'image/png'


def write_glb(path, gltf, binblob):
    gltf['buffers'] = [{'byteLength': len(binblob)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4); binblob += b'\0' * (-len(binblob) % 4)
    total = 12 + 8 + len(js) + 8 + len(binblob)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binblob), 0x004E4942) + binblob)
    print(os.path.basename(path), round(total / 1024), 'Ko')


def add_view(gltf, blob, data):
    blob += b'\0' * (-len(blob) % 4)
    gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
    blob += data
    return len(gltf['bufferViews']) - 1, blob


def body(name, skin_png):
    j = json.load(open(os.path.join(BODY_DIR, name + '.gltf')))
    blob = open(os.path.join(BODY_DIR, j['buffers'][0]['uri']), 'rb').read()
    imgs = [(jpeg(os.path.join(HAIR_DIR, 'T_Hair_1_BaseColor.png'), 512), 'hair'),
            (png(os.path.join(BODY_DIR, 'T_Eye_Brown.png'), 256), 'eye'),
            (jpeg(os.path.join(TEX_DIR, skin_png), 1024, 88), 'skin')]
    j['images'] = []; j['textures'] = []
    for (data, mime), nm in imgs:
        v, blob = add_view(j, blob, data)
        j['images'].append({'bufferView': v, 'mimeType': mime, 'name': nm}); j['textures'].append({'sampler': 0, 'source': len(j['images']) - 1})
    for m in j['materials']:
        k = {'MI_Hair_1': 0, 'MI_Hair_2': 0, 'MI_Eyes': 1}.get(m['name'], 2)
        m.pop('normalTexture', None)
        m['pbrMetallicRoughness'] = {'baseColorTexture': {'index': k}, 'metallicFactor': 0, 'roughnessFactor': 0.8}
    write_glb(os.path.join(OUT, name.replace('Superhero_Male_FullBody', 'body_m').replace('Superhero_Female_FullBody', 'body_f') + '.glb'), j, blob)


def accessor(j, blob, idx):
    a = j['accessors'][idx]; v = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    ct = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4)}[a['componentType']]
    stride = v.get('byteStride') or n * ct[1]
    out = array(ct[0])
    for i in range(a['count']):
        out.extend(struct.unpack_from('<' + ct[0] * n, blob, off + i * stride))
    return out, n, a


def hair():
    parts = ['Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted', 'Hair_Beard', 'Eyebrows_Regular', 'Eyebrows_Female']
    g = {'asset': {'version': '2.0', 'generator': 'prep_chars.py'}, 'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'materials': [], 'images': [], 'textures': [], 'samplers': [{'magFilter': 9729, 'minFilter': 9987}]}
    blob = b''
    for k, f in enumerate(['T_Hair_1_BaseColor.png', 'T_Hair_2_BaseColor.png']):
        data, mime = jpeg(os.path.join(HAIR_DIR, f), 1024, 84)
        v, blob = add_view(g, blob, data)
        g['images'].append({'bufferView': v, 'mimeType': mime}); g['textures'].append({'sampler': 0, 'source': k})
        g['materials'].append({'name': 'Hair%d' % (k + 1), 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': k}, 'metallicFactor': 0, 'roughnessFactor': 0.85}})
    for p in parts:
        j = json.load(open(os.path.join(HAIR_DIR, p + '.gltf'))); b = open(os.path.join(HAIR_DIR, j['buffers'][0]['uri']), 'rb').read()
        prim = j['meshes'][0]['primitives'][0]; at = prim['attributes']
        mat = 1 if j['materials'][prim['material']]['name'] == 'MI_Hair_2' else 0
        out = {}
        for key, src in (('POSITION', at['POSITION']), ('NORMAL', at['NORMAL']), ('TEXCOORD_0', at['TEXCOORD_0']), ('indices', prim['indices'])):
            arr, n, a = accessor(j, b, src)
            data = arr.tobytes(); v, blob = add_view(g, blob, data)
            g['bufferViews'][v]['target'] = 34963 if key == 'indices' else 34962
            ac = {'bufferView': v, 'componentType': a['componentType'], 'count': a['count'], 'type': a['type']}
            if key == 'POSITION': ac['min'] = [min(arr[i::3]) for i in range(3)]; ac['max'] = [max(arr[i::3]) for i in range(3)]
            g['accessors'].append(ac); out[key] = len(g['accessors']) - 1
        g['meshes'].append({'name': p, 'primitives': [{'attributes': {'POSITION': out['POSITION'], 'NORMAL': out['NORMAL'], 'TEXCOORD_0': out['TEXCOORD_0']}, 'indices': out['indices'], 'material': mat}]})
        g['nodes'].append({'name': p, 'mesh': len(g['meshes']) - 1}); g['scenes'][0]['nodes'].append(len(g['nodes']) - 1)
    write_glb(os.path.join(OUT, 'hair.glb'), g, blob)


body('Superhero_Male_FullBody', 'T_Superhero_Male_Dark.png')
if '--female' in sys.argv: body('Superhero_Female_FullBody', 'T_Superhero_Female_Dark_BaseColor.png')  # inutilisé pour l'instant
hair()
