<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  let { ...restProps }: CommandPrimitive.EmptyProps = $props();
</script>

<CommandPrimitive.Empty class="py-6 text-center text-sm" {...restProps} />
