<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  let { ...restProps }: DropdownMenuPrimitive.SubProps = $props();
</script>

<DropdownMenuPrimitive.Sub {...restProps} />
