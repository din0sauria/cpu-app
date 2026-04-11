export const POC_DEMO_LIST = [
  'Spectre V1',
  'Spectre V2',
  'Meltdown',
  'Flush+Reload'
]

export const EXP_DEMO_LIST = [
  'Spectre V1',
  'Spectre V2',
  'Meltdown',
  'Flush+Reload'
]

export const isPocDemoAvailable = (vulnName) => {
  return POC_DEMO_LIST.includes(vulnName)
}

export const isExpDemoAvailable = (vulnName) => {
  return EXP_DEMO_LIST.includes(vulnName)
}
