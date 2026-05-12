-- Second-pass room inference for move_inventory rows still classified as 'Other'.
-- Uses item name keywords when the slug-based lookup in 20260511140000 had no match.

UPDATE public.move_inventory
SET room = CASE
  -- Bedroom keywords
  WHEN item_name ~* '\y(bed frame|bedframe|mattress|dresser|nightstand|wardrobe|armoire|chest of drawers|headboard|platform bed|bunk bed|bedroom)\y'
    THEN 'Bedroom'
  -- Living room keywords
  WHEN item_name ~* '\y(sofa|couch|sectional|loveseat|recliner|armchair|accent chair|coffee table|side table|end table|lamp|tv stand|entertainment unit|bookshelf|bookcase|display cabinet|console table|ottoman|pouf|fireplace)\y'
    THEN 'Living Room'
  -- Dining room keywords
  WHEN item_name ~* '\y(dining table|dining chair|bar stool|buffet|sideboard|china cabinet|hutch|bar cart|wine rack|kitchen table)\y'
    THEN 'Dining Room'
  -- Kitchen keywords
  WHEN item_name ~* '\y(fridge|refrigerator|stove|range|oven|microwave|dishwasher|washer|dryer|freezer|kitchen cabinet|kitchen island|wine fridge|wine cooler)\y'
    THEN 'Kitchen'
  -- Office keywords
  WHEN item_name ~* '\y(desk|office chair|filing cabinet|monitor stand|printer|bookshelf|computer)\y'
    THEN 'Office'
  -- Outdoor/patio keywords
  WHEN item_name ~* '\y(patio|outdoor|garden|deck chair|deck table|bbq|barbecue|grill|lawn)\y'
    THEN 'Outdoor'
  -- Garage/gym keywords
  WHEN item_name ~* '\y(treadmill|elliptical|exercise bike|weight bench|gym|workbench|tool chest|bicycle|bike|toolbox)\y'
    THEN 'Garage'
  -- Kids room keywords
  WHEN item_name ~* '\y(crib|changing table|high chair|toy chest|kids desk|rocking chair|glider)\y'
    THEN 'Kids Room'
  -- Bathroom keywords
  WHEN item_name ~* '\y(bathroom cabinet|vanity|medicine cabinet|linen cabinet)\y'
    THEN 'Bathroom'
  ELSE room
END
WHERE room = 'Other';
