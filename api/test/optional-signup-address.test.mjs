import assert from 'node:assert/strict';
import test from 'node:test';

import { profileUpsertSchema } from '../dist/http/routes/me.js';

const requiredProfile = {
  display_name: 'Optional Address Member',
  email: 'member@example.com',
};

test('registration profile accepts an omitted address', () => {
  const result = profileUpsertSchema.parse(requiredProfile);
  assert.equal(result.house_line, undefined);
  assert.equal(result.street_line, undefined);
  assert.equal(result.postcode, undefined);
  assert.equal(result.city, undefined);
  assert.equal(result.state, undefined);
});

test('registration profile accepts blank or partially supplied address fields', () => {
  const blank = profileUpsertSchema.parse({
    ...requiredProfile,
    house_line: '',
    street_line: '',
    postcode: '',
    city: '',
    state: '',
  });
  assert.equal(blank.house_line, '');

  const partial = profileUpsertSchema.parse({
    ...requiredProfile,
    city: 'Broga',
    state: 'Selangor',
  });
  assert.equal(partial.city, 'Broga');
  assert.equal(partial.state, 'Selangor');
});
