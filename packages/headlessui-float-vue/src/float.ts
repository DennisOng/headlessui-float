import {
  defineComponent,
  ref,
  shallowRef,
  computed,
  watch,
  provide,
  inject,
  onMounted,
  h,
  Teleport,
  Transition,
  cloneVNode,
  createCommentVNode,

  // types
  Ref,
  ShallowRef,
  PropType,
  InjectionKey,
  VNode,
} from 'vue'
import { offset, flip, shift, autoPlacement, hide, autoUpdate, Placement, Strategy, Middleware, MiddlewareData } from '@floating-ui/dom'
import throttle from 'lodash.throttle'
import { useFloating, arrow, AuthUpdateOptions } from './useFloating'
import { PlacementClassResolver, defaultPlacementClassResolver } from './placement-class-resolvers'
import { filterSlot, flattenFragment, isValidElement } from './utils/render'
import { dom } from './utils/dom'

interface FloatState {
  open: Ref<boolean>
  referenceRef: Ref<HTMLElement | null>
  floatingRef: Ref<HTMLElement | null>
  floatingX: Ref<number | undefined>
  floatingY: Ref<number | undefined>
  arrowX: Ref<number | undefined>
  arrowY: Ref<number | undefined>
  placement: Ref<Placement>
  strategy: Ref<Strategy>
  middleware: Ref<Middleware[]>
  middlewareData: Ref<MiddlewareData>
  zIndex: number
  transition: boolean
  enter?: string
  enterFrom?: string
  enterTo?: string
  leave?: string
  leaveFrom?: string
  leaveTo?: string
  teleport: boolean | string
  placementClass: string | PlacementClassResolver
}

type ArrowEl = Ref<HTMLElement | null>

const FloatContext = Symbol() as InjectionKey<FloatState>
const ArrowElContext = Symbol() as InjectionKey<ArrowEl>

function useFloatContext(component: string) {
  let context = inject(FloatContext, null)

  if (context === null) {
    let err = new Error(`<${component} /> is missing a parent <Float /> component.`)
    // @ts-ignore
    if (Error.captureStackTrace) Error.captureStackTrace(err, useFloatContext)
    throw err
  }

  return context
}

export function useArrow() {
  const arrowEl = inject(ArrowElContext, ref(null))

  provide(ArrowElContext, arrowEl)

  return arrowEl
}

export const Float = defineComponent({
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
      type: [Boolean, Number],
      default: 6,
    },
    flip: {
      type: Boolean,
      default: false,
    },
    arrow: {
      type: [Boolean, Number],
      default: false,
    },
    autoPlacement: {
      type: [Boolean, Object],
      default: false,
    },
    hide: {
      type: Boolean,
      default: false,
    },
    autoUpdate: {
      type: [Boolean, Object] as PropType<boolean | AuthUpdateOptions>,
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
    enter: String,
    enterFrom: String,
    enterTo: String,
    leave: String,
    leaveFrom: String,
    leaveTo: String,
    teleport: {
      type: [Boolean, String],
      default: false,
    },
    placementClass: {
      type: [String, Function] as PropType<string | PlacementClassResolver>,
      default: defaultPlacementClassResolver,
    },
    middleware: {
      type: Array as PropType<Middleware[]>,
      default: () => [],
    },
  },
  emits: ['update', 'show', 'hide'],
  setup(props, { slots, emit }) {
    const open = ref(false)
    const middleware = shallowRef(undefined) as ShallowRef<Middleware[] | undefined>

    const arrowEl = useArrow()
    const arrowX = ref<number | undefined>(undefined)
    const arrowY = ref<number | undefined>(undefined)

    const { x, y, placement, strategy, reference, floating, middlewareData, update } = useFloating({
      placement: props.placement,
      strategy: props.strategy,
      middleware,
    })

    function buildMiddleware() {
      middleware.value = []
      if (typeof props.offset === 'number') {
        middleware.value.push(offset(props.offset))
      }
      if (props.shift === true || typeof props.shift === 'number') {
        middleware.value.push(shift({
          padding: props.shift === true ? 6 : props.shift,
        }))
      }
      if (props.flip) {
        middleware.value.push(flip())
      }
      if (props.arrow === true || typeof props.arrow === 'number') {
        middleware.value.push(arrow({
          element: arrowEl,
          padding: props.arrow === true ? 0 : props.arrow,
        }))
      }
      if (props.autoPlacement !== false) {
        middleware.value.push(autoPlacement(
          typeof props.autoPlacement === 'object'
            ? props.autoPlacement
            : undefined
        ))
      }
      if (props.hide) {
        middleware.value.push(hide())
      }
      return middleware.value.concat(props.middleware)
    }

    const api = {
      open,
      referenceRef: reference,
      floatingRef: floating,
      floatingX: x,
      floatingY: y,
      arrowX,
      arrowY,
      placement,
      strategy,
      middleware,
      middlewareData,
      zIndex: props.zIndex,
      transition: props.transition,
      enter: props.enter,
      enterFrom: props.enterFrom,
      enterTo: props.enterTo,
      leave: props.leave,
      leaveFrom: props.leaveFrom,
      leaveTo: props.leaveTo,
      teleport: props.teleport,
      placementClass: props.placementClass,
    } as FloatState

    provide(FloatContext, api)

    let cleanAutoUpdate: (() => void) | undefined

    const showFloating = () => {
      if (dom(reference) &&
          dom(floating) &&
          props.autoUpdate !== false &&
          !cleanAutoUpdate
      ) {
        cleanAutoUpdate = autoUpdate(
          dom(reference)!,
          dom(floating)!,
          throttle(update, 16),
          props.autoUpdate === true ? undefined : props.autoUpdate
        )
        emit('show')
      }
    }

    const hideFloating = () => {
      if (cleanAutoUpdate) cleanAutoUpdate()
      cleanAutoUpdate = undefined
      emit('hide')
    }

    onMounted(() => {
      middleware.value = buildMiddleware()

      if (dom(floating) && dom(floating)?.nodeType !== Node.COMMENT_NODE) {
        showFloating()
      }
    })

    watch(open, () => {
      if (open.value) {
        showFloating()
      } else {
        hideFloating()
      }
    })

    watch(middlewareData, () => {
      const arrowData = middlewareData.value.arrow as { x?: number, y?: number }
      arrowX.value = arrowData?.x
      arrowY.value = arrowData?.y
    })

    watch([x, y, placement, strategy, middlewareData], () => {
      emit('update')
    })

    return () => {
      if (slots.default) {
        const [referenceNode, floatingNode, ...otherNodes] = filterSlot(flattenFragment(slots.default() || []))

        if (!isValidElement(referenceNode)) {
          return
        }

        const placementClassValue = computed(() => {
          if (typeof api.placementClass === 'function') {
            return api.placementClass(api.placement.value)
          }
          return api.placementClass
        })

        const transitionProps = {
          enterActiveClass: api.transition ? `${api.enter} ${placementClassValue.value}` : undefined,
          enterFromClass: api.transition ? api.enterFrom : undefined,
          enterToClass: api.transition ? api.enterTo : undefined,
          leaveActiveClass: api.transition ? `${api.leave} ${placementClassValue.value}` : undefined,
          leaveFromClass: api.transition ? api.leaveFrom : undefined,
          leaveToClass: api.transition ? api.leaveTo : undefined,
          onBeforeEnter() {
            api.open.value = true
          },
          onAfterLeave() {
            api.open.value = false
          },
        }

        const floatingStyle = {
          position: api.strategy.value,
          zIndex: api.zIndex,
          top: typeof api.floatingY.value === 'number' ? `${api.floatingY.value}px` : '',
          left: typeof api.floatingX.value === 'number' ? `${api.floatingX.value}px` : '',
        }

        const wrapTeleport = (node: VNode) => {
          if (api.teleport === false) {
            return node
          }
          return h(Teleport, { to: api.teleport === true ? 'body' : api.teleport }, [node])
        }

        return [
          cloneVNode(referenceNode, { ref: api.referenceRef }),

          wrapTeleport(h(Transition, transitionProps, () =>
            floatingNode
              ? cloneVNode(floatingNode, { ref: api.floatingRef, style: floatingStyle })
              : createCommentVNode()
          )),

          ...otherNodes,
        ]
      }
    }
  },
})

export const FloatArrow = defineComponent({
  name: 'FloatArrow',
  setup(props, { slots, attrs }) {
    const api = useFloatContext('FloatArrow')
    const arrowEl = inject(ArrowElContext, null)

    if (arrowEl === null) {
      let err = new Error(`<FloatArrow /> must be in the Items component of the Headless UI.`)
      // @ts-ignore
      if (Error.captureStackTrace) Error.captureStackTrace(err, FloatArrow)
      throw err
    }

    return () => {
      const staticSide = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      }[api.placement.value.split('-')[0]]!

      const style = {
        left: typeof api.arrowX.value === 'number' ? `${api.arrowX.value}px` : '',
        top: typeof api.arrowY.value === 'number' ? `${api.arrowY.value}px` : '',
        right: '',
        bottom: '',
        [staticSide]: '-4px',
      }

      const props = { ref: arrowEl, style }

      const node = slots.default?.()[0]
      return node
        ? cloneVNode(node, props)
        : h('div', Object.assign({}, attrs, props))
    }
  },
})
