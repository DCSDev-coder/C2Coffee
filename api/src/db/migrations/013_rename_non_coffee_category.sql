-- Rename the generic non-coffee bucket to a more specific drink type.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

UPDATE menu_categories
SET name = 'Barista Craft'
WHERE code = 'non_coffee';
