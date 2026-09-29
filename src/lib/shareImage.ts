export async function nodeToImageBlob(node: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(node, { useCORS: true, backgroundColor: '#FFFFFF', scale: 2 })
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
  })
}

export async function shareOrDownloadImage(blob: Blob, filename: string, shareTitle: string, shareText: string) {
  const file = new File([blob], filename, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: ShareData) => Promise<void> }
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle, text: shareText })
      return { shared: true as const }
    } catch {
      // El usuario canceló el share sheet, o falló — cae al descargar.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { shared: false as const }
}
