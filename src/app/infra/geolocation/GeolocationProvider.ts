import geoip from 'geoip-lite';

export interface LocationInfo {
    city: string | null;
    region: string | null;
    country: string | null;
}

export interface IGeolocationProvider {
    lookup(ip: string): LocationInfo;
}

export class GeolocationProvider implements IGeolocationProvider {
    lookup(ip: string): LocationInfo {
        const result = geoip.lookup(ip);

        if (!result) {
            return { city: null, region: null, country: null }; // IP local (ex: ::1 em dev) não resolve
        }

        return {
            city: result.city || null,
            region: result.region || null,
            country: result.country || null,
        };
    }
}
