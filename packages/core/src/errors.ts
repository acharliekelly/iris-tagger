export class ImageNotFoundError extends Error {
  constructor() { super('Image not found'); this.name = 'ImageNotFoundError'; }
}
export class ImageReadOnlyError extends Error {
  constructor() { super('Image is read-only'); this.name = 'ImageReadOnlyError'; }
}
