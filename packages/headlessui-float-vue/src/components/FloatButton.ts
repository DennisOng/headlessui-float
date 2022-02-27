import { defineComponent, inject, cloneVNode } from 'vue'
import { floatApiKey, referenceKey } from '../composables/useFloat'

export default defineComponent({
  name: 'FloatButton',
  setup(props, { slots }) {
    const floatApi = inject(floatApiKey)
    if (!floatApi) {
      console.error(`[headlessui-float]: <FloatButton> must be move in <Float> component.`)
      return
    }

    const referenceRef = inject(referenceKey)!

    return () => {
      if (slots.default) {
        const [node] = slots.default()
        return node
          ? cloneVNode(node, { ref: referenceRef })
          : undefined
      }
    }
  },
})