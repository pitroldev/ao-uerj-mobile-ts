#import <AppSpecs/AppSpecs.h>
#import <Foundation/Foundation.h>
#import <Security/Security.h>

/**
 * O cofre do app para o JS (spec: src/specs/NativeSecureVault.ts), como o
 * SecureVault.kt do Android: textos cifrados em arquivos fora do backup.
 *
 * A cifra é ECIES (AES-GCM com chave de sessão por ECDH) com uma chave P-256
 * não exportável no Keychain, só deste aparelho. Os arquivos também têm a
 * proteção de dados do iOS. Um arquivo que não decifra mais (chave perdida
 * numa restauração ou conteúdo alterado) é apagado e lido como ausente.
 */
@interface SecureVaultModule : NSObject <NativeSecureVaultSpec>
@end

static NSString *const kKeyTag = @"br.uerj.ao.secure-vault";
static NSString *const kDirectory = @"secure-vault";
static const uint8_t kFormatVersion = 1;

static NSString *const VaultError = @"E_SECURE_VAULT";

@implementation SecureVaultModule {
  dispatch_queue_t _queue;
}

+ (NSString *)moduleName
{
  return @"SecureVault";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSecureVaultSpecJSI>(params);
}

- (instancetype)init
{
  if (self = [super init]) {
    _queue = dispatch_queue_create("br.uerj.ao.secure-vault", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

// Cifra e arquivos numa fila só, em ordem: uma gravação nunca é lida pela metade.
- (dispatch_queue_t)methodQueue
{
  return _queue;
}

#pragma mark - Spec

- (void)read:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSURL *file = [self fileForName:name];
  if (!file) {
    reject(VaultError, @"invalid vault item name", nil);
    return;
  }
  NSData *bytes = [NSData dataWithContentsOfURL:file];
  if (!bytes) {
    resolve(nil);
    return;
  }
  NSString *text = [self decrypt:bytes];
  if (!text) {
    [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
    resolve(nil);
    return;
  }
  resolve(text);
}

- (void)write:(NSString *)name
        value:(NSString *)value
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  NSURL *file = [self fileForName:name];
  if (!file) {
    reject(VaultError, @"invalid vault item name", nil);
    return;
  }
  NSError *error = nil;
  NSData *bytes = [self encrypt:value error:&error];
  // inteiro ou nada: a cópia anterior fica até a nova estar completa
  if (!bytes ||
      ![bytes writeToURL:file
                 options:NSDataWritingAtomic | NSDataWritingFileProtectionCompleteUntilFirstUserAuthentication
                   error:&error]) {
    reject(VaultError, error.localizedDescription ?: @"could not write", error);
    return;
  }
  resolve(nil);
}

- (void)remove:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSURL *file = [self fileForName:name];
  if (!file) {
    reject(VaultError, @"invalid vault item name", nil);
    return;
  }
  [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
  resolve(nil);
}

- (void)removePrefix:(NSString *)prefix
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  NSURL *directory = [self directory];
  NSArray<NSURL *> *items = directory
      ? [[NSFileManager defaultManager] contentsOfDirectoryAtURL:directory
                                      includingPropertiesForKeys:nil
                                                         options:0
                                                           error:nil]
      : @[];
  for (NSURL *item in items) {
    NSString *decoded = [self nameFromFile:item.lastPathComponent];
    if (!decoded || [decoded hasPrefix:prefix]) {
      [[NSFileManager defaultManager] removeItemAtURL:item error:nil];
    }
  }
  resolve(nil);
}

#pragma mark - Arquivos

- (nullable NSURL *)directory
{
  NSFileManager *files = [NSFileManager defaultManager];
  NSURL *support = [[files URLsForDirectory:NSApplicationSupportDirectory inDomains:NSUserDomainMask] firstObject];
  if (!support) {
    return nil;
  }
  NSURL *directory = [support URLByAppendingPathComponent:kDirectory isDirectory:YES];
  if (![files fileExistsAtPath:directory.path]) {
    [files createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:nil error:nil];
    // fora do backup do iCloud e do computador, como o noBackupFilesDir do Android
    [directory setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
  }
  return directory;
}

static BOOL IsValidName(NSString *name)
{
  if (name.length == 0 || name.length > 160) {
    return NO;
  }
  NSCharacterSet *allowed =
      [NSCharacterSet characterSetWithCharactersInString:
                          @"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:-"];
  return [name rangeOfCharacterFromSet:allowed.invertedSet].location == NSNotFound;
}

// Nome do item em base64url (sem "/" nem ":" no nome do arquivo), como no Android.
- (nullable NSURL *)fileForName:(NSString *)name
{
  if (!IsValidName(name)) {
    return nil;
  }
  NSString *encoded = [[name dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0];
  encoded = [[[encoded stringByReplacingOccurrencesOfString:@"+" withString:@"-"]
      stringByReplacingOccurrencesOfString:@"/"
                                withString:@"_"] stringByReplacingOccurrencesOfString:@"="
                                                                           withString:@""];
  return [[self directory] URLByAppendingPathComponent:encoded isDirectory:NO];
}

- (nullable NSString *)nameFromFile:(NSString *)file
{
  NSString *base64 = [[file stringByReplacingOccurrencesOfString:@"-" withString:@"+"]
      stringByReplacingOccurrencesOfString:@"_"
                                withString:@"/"];
  while (base64.length % 4 != 0) {
    base64 = [base64 stringByAppendingString:@"="];
  }
  NSData *bytes = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
  return bytes ? [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] : nil;
}

#pragma mark - Cifra

// Devolve a chave retida (o chamador libera).
- (nullable SecKeyRef)copyPrivateKey
{
  NSData *tag = [kKeyTag dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *query = @{
    (__bridge id)kSecClass : (__bridge id)kSecClassKey,
    (__bridge id)kSecAttrApplicationTag : tag,
    (__bridge id)kSecAttrKeyType : (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecReturnRef : @YES,
  };
  SecKeyRef key = NULL;
  if (SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef *)&key) == errSecSuccess && key) {
    return key;
  }
  NSDictionary *attributes = @{
    (__bridge id)kSecAttrKeyType : (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecAttrKeySizeInBits : @256,
    (__bridge id)kSecPrivateKeyAttrs : @{
      (__bridge id)kSecAttrIsPermanent : @YES,
      (__bridge id)kSecAttrApplicationTag : tag,
      (__bridge id)kSecAttrAccessible : (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    },
  };
  CFErrorRef error = NULL;
  key = SecKeyCreateRandomKey((__bridge CFDictionaryRef)attributes, &error);
  if (error) {
    CFRelease(error);
  }
  return key;
}

- (nullable NSData *)encrypt:(NSString *)text error:(NSError **)outError
{
  SecKeyRef privateKey = [self copyPrivateKey];
  if (!privateKey) {
    return nil;
  }
  SecKeyRef publicKey = SecKeyCopyPublicKey(privateKey);
  CFRelease(privateKey);
  if (!publicKey) {
    return nil;
  }
  CFErrorRef error = NULL;
  CFDataRef encrypted = SecKeyCreateEncryptedData(
      publicKey,
      kSecKeyAlgorithmECIESEncryptionCofactorVariableIVX963SHA256AESGCM,
      (__bridge CFDataRef)[text dataUsingEncoding:NSUTF8StringEncoding],
      &error);
  CFRelease(publicKey);
  if (!encrypted) {
    if (outError && error) {
      *outError = (__bridge_transfer NSError *)error;
    } else if (error) {
      CFRelease(error);
    }
    return nil;
  }
  NSMutableData *bytes = [NSMutableData dataWithBytes:&kFormatVersion length:1];
  [bytes appendData:(__bridge_transfer NSData *)encrypted];
  return bytes;
}

- (nullable NSString *)decrypt:(NSData *)bytes
{
  if (bytes.length <= 1 || ((const uint8_t *)bytes.bytes)[0] != kFormatVersion) {
    return nil;
  }
  SecKeyRef privateKey = [self copyPrivateKey];
  if (!privateKey) {
    return nil;
  }
  CFErrorRef error = NULL;
  CFDataRef decrypted = SecKeyCreateDecryptedData(
      privateKey,
      kSecKeyAlgorithmECIESEncryptionCofactorVariableIVX963SHA256AESGCM,
      (__bridge CFDataRef)[bytes subdataWithRange:NSMakeRange(1, bytes.length - 1)],
      &error);
  CFRelease(privateKey);
  if (!decrypted) {
    if (error) {
      CFRelease(error);
    }
    return nil;
  }
  return [[NSString alloc] initWithData:(__bridge_transfer NSData *)decrypted encoding:NSUTF8StringEncoding];
}

@end
