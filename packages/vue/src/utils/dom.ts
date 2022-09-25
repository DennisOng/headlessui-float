import { type Ref, unref } from 'vue'

// See: https://github.com/tailwindlabs/headlessui/blob/d8424fe311923f6858f6e3d55083df957bca824d/packages/%40headlessui-vue/src/utils/dom.ts#L3-L7

export function dom<T extends HTMLElement>(ref?: Ref<T | null> | T | null): T | null {
  ref = unref(ref)
  if (ref == null) return null

  // Workaround for issue: https://github.com/ycs77/headlessui-float/issues/23
  if ((ref as T & { $el: any })?.$el?.$el) {
    return (ref as T & { $el: any })?.$el.$el
  }

  return ((ref as T & { $el: unknown })?.$el ?? ref) as T | null
}
