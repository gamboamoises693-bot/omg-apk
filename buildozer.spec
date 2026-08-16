[app]
title = Omega Ice Combined
package.name = omegaicecombined
package.domain = com.isesmo.omega
source.dir =.
source.include_exts = py,png,jpg,kv,atlas,db
version = 1.0
requirements = python3,kivy==2.3.0,kivymd==1.1.1
orientation = portrait
fullscreen = 0
android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE,MANAGE_EXTERNAL_STORAGE,INTERNET
android.api = 34
android.minapi = 21
android.ndk = 28c
android.accept_sdk_license_agreement = True
android.ant = auto

[buildozer]
log_level = 2
warn_on_root = 1
