// Shared constants for the Item form and the Master Item edit screen.
// Both surfaces let users choose a packaging type from the same fixed set,
// so the source lives here rather than duplicated in each screen.

export const PACKAGING_TYPE_OPTIONS = [
  {label: 'None', value: ''},
  {label: 'Bag', value: 'bag'},
  {label: 'Bottle', value: 'bottle'},
  {label: 'Box', value: 'box'},
  {label: 'Bundle', value: 'bundle'},
  {label: 'Can', value: 'can'},
  {label: 'Carton', value: 'carton'},
  {label: 'Crate', value: 'crate'},
  {label: 'Drum', value: 'drum'},
  {label: 'Jar', value: 'jar'},
  {label: 'Loaf', value: 'loaf'},
  {label: 'Pack', value: 'pack'},
  {label: 'Pail', value: 'pail'},
  {label: 'Pouch', value: 'pouch'},
  {label: 'Sack', value: 'sack'},
  {label: 'Tray', value: 'tray'},
  {label: 'Tub', value: 'tub'},
  {label: 'Tube', value: 'tube'},
];
