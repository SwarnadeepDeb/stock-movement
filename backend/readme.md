variant_inventory.quantity represents the total physical
pieces currently available for a color variant and design size.

Transformations such as:
- loose → set
- loose → bundle
- set/bundle → unset/reset

do not modify variant_inventory because they preserve
the total physical piece count.

Only operations that change the total physical quantity
should modify variant_inventory:
- Stock In → increment
- Stock Out → decrement
- Future adjustments/losses → increment/decrement as appropriate