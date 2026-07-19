export async function enterFullScreen(): Promise<void> {
  if (!document.fullscreenEnabled || document.fullscreenElement) return

  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" })
  } catch (error) {
    console.info(error)
  }
}

export async function exitFullScreen(): Promise<void> {
  if (!document.fullscreenEnabled || !document.fullscreenElement) return

  try {
    await document.exitFullscreen()
  } catch (error) {
    console.info(error)
  }
}

export async function toggleFullScreen(): Promise<void> {
  if (!document.fullscreenElement) {
    await enterFullScreen()
  } else {
    await exitFullScreen()
  }
}
