import { useSnackbar } from 'notistack'

interface CopyButtonProps {
  value: string
  label?: string
}

export const CopyButton = ({ value, label = 'Copy' }: CopyButtonProps) => {
  const { enqueueSnackbar } = useSnackbar()

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      enqueueSnackbar('Copied to clipboard', { variant: 'success' })
    } catch {
      enqueueSnackbar('Failed to copy', { variant: 'error' })
    }
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={onCopy}>
      {label}
    </button>
  )
}
