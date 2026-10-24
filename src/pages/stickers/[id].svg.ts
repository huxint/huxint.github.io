import type { APIRoute, GetStaticPaths } from 'astro';
import { stickers } from '../../lib/stickers/catalog.mjs';
import { drawSticker } from '../../lib/stickers/art.mjs';

export const getStaticPaths = (() =>
  stickers.map((sticker) => ({
    params: { id: sticker.id },
    props: { sticker },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(drawSticker(props.sticker), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
