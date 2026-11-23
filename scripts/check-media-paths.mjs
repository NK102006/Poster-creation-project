import assert from 'node:assert/strict';
import { resolveMediaUrl, normalizeUploadPaths } from '../src/lib/mediaUrl.js';
const options = { base: '/Poster-Creater/', origin: 'https://doctorly.in' };
for (const value of ['uploads/master_posters/example.jpeg', '/uploads/master_posters/example.jpeg',
  '/Poster-Creater/uploads/master_posters/example.jpeg', 'https://doctorly.in/uploads/master_posters/example.jpeg',
  'https://doctorly.in/Poster-Creater/uploads/master_posters/example.jpeg']) {
  assert.equal(resolveMediaUrl(value, options), '/Poster-Creater/uploads/master_posters/example.jpeg');
}
assert.equal(resolveMediaUrl('uploads\\logos\\doctor.png', options), '/Poster-Creater/uploads/logos/doctor.png');
assert.equal(resolveMediaUrl('/uploads/video.mp4?download=1#clip', options), '/Poster-Creater/uploads/video.mp4?download=1#clip');
for (const value of ['https://cdn.example.com/image.jpg', 'data:image/png;base64,abc', 'blob:https://doctorly.in/id', '', null]) {
  assert.equal(resolveMediaUrl(value, options), value);
}
assert.equal(resolveMediaUrl('uploads/image.png', { base: '/', origin: options.origin }), '/uploads/image.png');
assert.equal(resolveMediaUrl('/Other/uploads/image.png', { base: '/Other/', origin: options.origin }), '/Other/uploads/image.png');
assert.equal(resolveMediaUrl('//cdn.example.com/image.jpg', options), '//cdn.example.com/image.jpg');
const record = normalizeUploadPaths({ name: 'Doctor', dynamicFields: { photo: 'uploads/photos/photo.png' }, posters: [{ image: '/uploads/posters/image.jpg' }] });
assert.equal(record.name, 'Doctor');
assert.equal(record.dynamicFields.photo, '/Poster-Creater/uploads/photos/photo.png');
assert.equal(record.posters[0].image, '/Poster-Creater/uploads/posters/image.jpg');
console.log('PASS: legacy, prefixed, absolute same-origin, external, Windows, image, video and nested record paths.');
