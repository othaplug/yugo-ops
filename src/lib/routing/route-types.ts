/** Subset of Mapbox Directions v5 route object we use for scoring and UI. */
export type MapboxDirectionRoute = {
  duration: number;
  distance: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: Array<{
    steps?: Array<{
      distance?: number;
      name?: string;
      maneuver?: {
        type?: string;
        instruction?: string;
        modifier?: string;
        location?: [number, number];
      };
    }>;
    annotation?: { congestion?: string[] };
  }>;
};

export type MapboxDirectionsResponse = {
  routes?: MapboxDirectionRoute[];
  code?: string;
  message?: string;
};
