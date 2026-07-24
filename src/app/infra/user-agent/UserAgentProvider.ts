import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
    browser: string | null;
    os: string | null;
    deviceType: string | null;
}

export interface IUserAgentProvider {
    parse(userAgentString: string): DeviceInfo;
}

export class UserAgentProvider implements IUserAgentProvider {
    parse(userAgentString: string): DeviceInfo {
        const result = UAParser(userAgentString);
        return {
            browser: result.browser.name ?? null,
            os: result.os.name ?? null,
            deviceType: result.device.type ?? 'desktop', // sem tipo definido geralmente é desktop
        };
    }
}
