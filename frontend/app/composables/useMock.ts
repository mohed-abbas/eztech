export function useMock() {
  const config = useRuntimeConfig()
  const isMock = computed(() => config.public.useMock as boolean)

  return { isMock }
}
