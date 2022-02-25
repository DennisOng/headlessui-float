import { defineComponent, ref, computed, nextTick, h, cloneVNode, Transition, Teleport, PropType, ComponentPublicInstance, VNode, onMounted, onBeforeUnmount } from 'vue'
import { computePosition, offset, flip, shift, getScrollParents, Placement, Strategy, Middleware, Platform } from '@floating-ui/dom'
import { defaultPlacementClassResolver } from '../placement-class-resolvers'
import { filterSlot, isValidElement } from '../utils/render'
import { PlacementClassResolver } from '../types'

export default defineComponent({
  name: 'Float',
  props: {
    placement: {
      type: String as PropType<Placement>,
      default: 'bottom-start',
    },
    strategy: {
      type: String as PropType<Strategy>,
      default: 'absolute',
    },
    offset: Number,
    shift: {
      type: [Boolean, Number] as PropType<number | false>,
      default: 6,
    },
    flip: {
      type: Boolean,
      default: true,
    },
    zIndex: {
      type: Number,
      default: 9999,
    },
    transition: {
      type: Boolean,
      default: false,
    },
    enterActiveClass: String,
    enterFromClass: String,
    enterToClass: String,
    leaveActiveClass: String,
    leaveFromClass: String,
    leaveToClass: String,
    originClass: String,
    teleport: {
      type: [Boolean, String],
      default: false,
    },
    placementClassResolver: {
      type: Function as PropType<PlacementClassResolver>,
      default: defaultPlacementClassResolver,
    },
    middleware: {
      type: Array as PropType<Middleware[]>,
      default: () => [],
    },
    platform: Object as PropType<Platform>,
  },
  setup(props, { slots }) {
    const referenceEl = ref<ComponentPublicInstance>(null!)
    const floatingEl = ref<ComponentPublicInstance>(null!)

    const placementOriginClass = computed(() => {
      return props.originClass || props.placementClassResolver(props.placement)
    })

    const getComputePositionOptions = () => {
      const middleware = []
      if (typeof props.offset === 'number') {
        middleware.push(offset(props.offset))
      }
      if (typeof props.shift === 'number') {
        middleware.push(shift({ padding: props.shift }))
      }
      if (props.flip) {
        middleware.push(flip())
      }

      const options = {
        placement: props.placement,
        strategy: props.strategy,
        middleware: middleware.concat(props.middleware),
      }
      if (props.platform) {
        Object.assign(options, { platform: props.platform })
      }
      return options
    }
    const options = getComputePositionOptions()

    const updateFloatingEl = () => {
      Object.assign(floatingEl.value.$el.style, {
        position: props.strategy,
        zIndex: props.zIndex,
      })

      computePosition(referenceEl.value.$el, floatingEl.value.$el, options).then(({ x, y }) => {
        Object.assign(floatingEl.value.$el.style, {
          left: `${x}px`,
          top: `${y}px`,
        })
      })
    }

    const hideFloatingEl = () => {
      if (floatingEl.value?.$el.style) {
        Object.assign(floatingEl.value.$el.style, {
          position: null,
          zIndex: null,
          left: null,
          top: null,
        })
      }
    }

    const attachListeners = () => {
      [
        ...getScrollParents(referenceEl.value.$el),
        ...getScrollParents(floatingEl.value.$el),
      ].forEach((el) => {
        el.addEventListener('scroll', updateFloatingEl)
        el.addEventListener('resize', updateFloatingEl)
      })
    }
    const detachListeners = () => {
      [
        ...getScrollParents(referenceEl.value.$el),
        ...(floatingEl.value?.$el ? getScrollParents(floatingEl.value.$el) : []),
      ].forEach((el) => {
        el.removeEventListener('scroll', updateFloatingEl)
        el.removeEventListener('resize', updateFloatingEl)
      })
    }

    const transitionProps = {
      enterActiveClass: props.transition ? `${props.enterActiveClass} ${placementOriginClass.value}` : undefined,
      enterFromClass: props.transition ? props.enterFromClass : undefined,
      enterToClass: props.transition ? props.enterToClass : undefined,
      leaveActiveClass: props.transition ? `${props.leaveActiveClass} ${placementOriginClass.value}` : undefined,
      leaveFromClass: props.transition ? props.leaveFromClass : undefined,
      leaveToClass: props.transition ? props.leaveToClass : undefined,
      async onBeforeEnter() {
        await nextTick()
        updateFloatingEl()
        attachListeners()
      },
      onBeforeLeave() {
        detachListeners()
      },
      onAfterLeave() {
        hideFloatingEl()
      },
    }

    const render = () => {
      const [referenceNode, defaultSlotContentNode] = filterSlot(slots.default?.() || [])
      const [contentSlotNode] = filterSlot(slots.content?.() || [])
      const floatingNode = contentSlotNode || defaultSlotContentNode

      if (!isValidElement(referenceNode)) {
        console.error(`[headlessui-float]: default slot must contains Headless UI's Button & Items Components.`)
        return
      }

      const wrapTeleport = (node: VNode) => {
        if (props.teleport === false) {
          return node
        }
        return h(Teleport, { to: props.teleport === true ? 'body' : props.teleport }, [node])
      }

      return [
        cloneVNode(referenceNode, { ref: referenceEl }),
        wrapTeleport(
          h(Transition, transitionProps, () => {
            return floatingNode ? cloneVNode(floatingNode, { ref: floatingEl }) : undefined
          })
        ),
      ]
    }

    return render
  },
})