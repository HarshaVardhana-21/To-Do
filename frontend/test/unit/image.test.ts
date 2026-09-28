import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resizeImage } from '../../src/lib/image'

/** jsdom can't decode images or draw on a canvas, so stand in for both. */
function stubImage({ width, height, fail = false }: { width: number; height: number; fail?: boolean }) {
  class FakeImage {
    naturalWidth = width
    naturalHeight = height
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_v: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()))
    }
  }
  vi.stubGlobal('Image', FakeImage)
}

describe('resizeImage', () => {
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
  let canvas: HTMLCanvasElement
  let context: typeof ctx | null

  beforeEach(() => {
    context = ctx
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag)
      if (tag === 'canvas') {
        canvas = el as HTMLCanvasElement
        vi.spyOn(canvas, 'getContext').mockImplementation(() => context as unknown as CanvasRenderingContext2D)
        vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,OUT')
      }
      return el
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    ctx.fillRect.mockReset()
    ctx.drawImage.mockReset()
  })

  const file = () => new File(['x'], 'me.png', { type: 'image/png' })

  it('center-crops to a square, scales to the target size, and returns a JPEG data URL', async () => {
    stubImage({ width: 400, height: 200 })
    await expect(resizeImage(file(), 100)).resolves.toBe('data:image/jpeg;base64,OUT')
    expect(canvas.width).toBe(100)
    expect(canvas.height).toBe(100)
    expect(ctx.fillStyle).toBe('#ffffff')
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 100, 0, 200, 200, 0, 0, 100, 100)
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('rejects (and still frees the object URL) when the image cannot be decoded', async () => {
    stubImage({ width: 1, height: 1, fail: true })
    await expect(resizeImage(file())).rejects.toThrow('Could not read that image')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('rejects when no 2D canvas context is available', async () => {
    stubImage({ width: 10, height: 10 })
    context = null
    await expect(resizeImage(file())).rejects.toThrow('Could not read that image')
  })
})
