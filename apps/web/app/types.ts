export interface ChartRequest {
  date_of_birth: string;
  time_of_birth?: string;
  birthplace: string;
  birth_time_quality: "exact" | "approximate" | "unknown";
}

export interface ChartResponse {
  chart: CanonicalChart;
  latitude: number;
  longitude: number;
  timezone: string;
  display_name: string;
}

export interface CanonicalChart {
  birth_profile_id: string;
  computed_at: string;
  ayanamsa: number;
  tropical_planets: PlanetPosition[];
  sidereal_planets: PlanetPosition[];
  houses_placidus: HouseCusp[];
  houses_whole_sign: HouseCusp[];
  ascendant_tropical: number;
  ascendant_sidereal: number;
  midheaven_tropical: number;
  midheaven_sidereal: number;
  aspects: Aspect[];
  vimshottari_dasha: DashaInfo | null;
  birth_time_quality: string;
  confidence_metadata: Record<string, string>;
}

export interface PlanetPosition {
  name: string;
  longitude: number;
  latitude: number;
  speed: number;
  sign: string;
  sign_degree: number;
  retrograde: boolean;
  nakshatra?: string;
  nakshatra_pada?: number;
  house?: number;
}

export interface HouseCusp {
  house_number: number;
  sign: string;
  degree: number;
  lord?: string;
}

export interface Aspect {
  planet1: string;
  planet2: string;
  aspect_type: string;
  orb: number;
  applying: boolean;
}

export interface DashaInfo {
  maha_lord: string;
  maha_start: string;
  maha_end: string;
  antar_lord?: string;
  antar_start?: string;
  antar_end?: string;
}
