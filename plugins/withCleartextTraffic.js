const {
	withAndroidManifest,
	withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const CERTIFICATE_FILES = [
	"sectigo_ca_dv_r36.pem",
	"sectigo_root_r46.pem",
];

module.exports = function withCleartextTraffic(config) {
	config = withAndroidManifest(config, (configWithManifest) => {
		const application = configWithManifest.modResults.manifest.application?.[0];

		if (application) {
			application.$["android:usesCleartextTraffic"] = "true";
			application.$["android:networkSecurityConfig"] =
				"@xml/network_security_config";
		}

		return configWithManifest;
	});

	config = withDangerousMod(config, [
		"android",
		async (configWithMod) => {
			const resDir = path.join(
				configWithMod.modRequest.platformProjectRoot,
				"app/src/main/res",
			);
			const xmlDir = path.join(resDir, "xml");
			const rawDir = path.join(resDir, "raw");
			const certsDir = path.join(__dirname, "certs");

			fs.mkdirSync(xmlDir, { recursive: true });
			fs.mkdirSync(rawDir, { recursive: true });

			const filePath = path.join(xmlDir, "network_security_config.xml");

			fs.writeFileSync(
				filePath,
				`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
	<base-config cleartextTrafficPermitted="true">
		<trust-anchors>
			<certificates src="system" />
			<certificates src="user" />
			<certificates src="@raw/sectigo_ca_dv_r36" />
			<certificates src="@raw/sectigo_root_r46" />
		</trust-anchors>
	</base-config>
</network-security-config>
`,
			);

			for (const certificateFile of CERTIFICATE_FILES) {
				fs.copyFileSync(
					path.join(certsDir, certificateFile),
					path.join(rawDir, certificateFile),
				);
			}

			return configWithMod;
		},
	]);

	return config;
};
