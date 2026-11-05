#import <AppSpecs/AppSpecs.h>
#import <CommonCrypto/CommonDigest.h>
#import <DeviceCheck/DeviceCheck.h>
#import <Foundation/Foundation.h>
#import <Security/Security.h>

/**
 * O App Attest da Apple e a criptografia da plataforma para o JS (spec:
 * src/specs/NativeAppAttest.ts), como o DeviceTrustModule.kt (Play Integrity)
 * do Android: a sessão de aluno (src/modules/trust) prova ao servidor que é
 * o app da loja, sem modificação, num iPhone de verdade.
 *
 * Cada entrada gera uma chave nova no Secure Enclave e pede à Apple que a
 * ateste sobre o hash do pedido (o `clientDataHash`). O servidor confere a
 * cadeia de certificados da Apple, o app e o hash. O simulador não tem App
 * Attest: lá, `isSupported` é falso e o app não entra como aluno.
 *
 * O DeviceCheck.framework vai ligado à mão no alvo (Frameworks): num .mm, o
 * `#import` não liga o framework sozinho, como o `import` do Swift faz.
 */
@interface AppAttestModule : NSObject <NativeAppAttestSpec>
@end

static NSString *const TransientError = @"E_APP_ATTEST_TRANSIENT";
static NSString *const UnavailableError = @"E_APP_ATTEST_UNAVAILABLE";
static const NSUInteger kMaxRandomBytes = 1024;

/** Rede ou servidor da Apple fora: vale tentar de novo daqui a pouco. */
static BOOL IsTransient(NSError *_Nullable error)
{
  if (!error) {
    return NO;
  }
  if ([error.domain isEqualToString:DCErrorDomain] && error.code == DCErrorServerUnavailable) {
    return YES;
  }
  if ([error.domain isEqualToString:NSURLErrorDomain]) {
    return YES;
  }
  id underlying = error.userInfo[NSUnderlyingErrorKey];
  return [underlying isKindOfClass:[NSError class]] &&
      [((NSError *)underlying).domain isEqualToString:NSURLErrorDomain];
}

/**
 * O resto (sem suporte, chave recusada, pedido errado, falha do sistema) não
 * melhora logo: o JS espera mais antes de gerar outra chave.
 */
static void Reject(RCTPromiseRejectBlock reject, NSString *step, NSError *_Nullable error)
{
  NSString *message = [NSString
      stringWithFormat:@"App Attest %@ failed (%@ %ld)", step, error.domain ?: @"no error", (long)error.code];
  reject(IsTransient(error) ? TransientError : UnavailableError, message, error);
}

static NSString *Base64(const void *bytes, NSUInteger length)
{
  return [[NSData dataWithBytes:bytes length:length] base64EncodedStringWithOptions:0];
}

@implementation AppAttestModule

+ (NSString *)moduleName
{
  return @"AppAttest";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppAttestSpecJSI>(params);
}

#pragma mark - Spec

- (NSNumber *)isSupported
{
  return @([DCAppAttestService.sharedService isSupported]);
}

- (void)attest:(NSString *)clientDataHash
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  NSData *hash = [[NSData alloc] initWithBase64EncodedString:clientDataHash options:0];
  if (hash.length != CC_SHA256_DIGEST_LENGTH) {
    reject(UnavailableError, @"clientDataHash must be 32 bytes in base64", nil);
    return;
  }
  DCAppAttestService *service = DCAppAttestService.sharedService;
  if (![service isSupported]) {
    reject(UnavailableError, @"App Attest is not supported on this device", nil);
    return;
  }
  // os retornos da Apple chegam numa fila qualquer; a promessa aceita
  [service generateKeyWithCompletionHandler:^(NSString *_Nullable keyId, NSError *_Nullable keyError) {
    if (!keyId) {
      Reject(reject, @"generateKey", keyError);
      return;
    }
    [service attestKey:keyId
           clientDataHash:hash
        completionHandler:^(NSData *_Nullable attestation, NSError *_Nullable attestError) {
          if (!attestation) {
            Reject(reject, @"attestKey", attestError);
            return;
          }
          // o id da chave já vem em base64 padrão; a atestação (CBOR), em bytes
          resolve(@{
            @"keyId" : keyId,
            @"attestation" : [attestation base64EncodedStringWithOptions:0],
          });
        }];
  }];
}

- (NSString *)randomBytes:(double)length
{
  if (!(length >= 1 && length <= kMaxRandomBytes)) {
    @throw [NSException exceptionWithName:NSInvalidArgumentException
                                   reason:[NSString stringWithFormat:@"Random length out of range: %g", length]
                                 userInfo:nil];
  }
  NSMutableData *bytes = [NSMutableData dataWithLength:(NSUInteger)length];
  if (SecRandomCopyBytes(kSecRandomDefault, bytes.length, bytes.mutableBytes) != errSecSuccess) {
    @throw [NSException exceptionWithName:NSInternalInconsistencyException
                                   reason:@"SecRandomCopyBytes failed"
                                 userInfo:nil];
  }
  return [bytes base64EncodedStringWithOptions:0];
}

- (NSString *)digest:(NSString *)algorithm data:(NSString *)data
{
  NSData *input = [[NSData alloc] initWithBase64EncodedString:data options:0];
  if (!input) {
    @throw [NSException exceptionWithName:NSInvalidArgumentException
                                   reason:@"Digest input is not base64"
                                 userInfo:nil];
  }
  // um ponteiro válido mesmo com zero bytes
  static const uint8_t kEmpty = 0;
  const void *bytes = input.length > 0 ? input.bytes : &kEmpty;
  CC_LONG size = (CC_LONG)input.length;
  if ([algorithm isEqualToString:@"SHA-256"]) {
    uint8_t out[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(bytes, size, out);
    return Base64(out, sizeof(out));
  }
  if ([algorithm isEqualToString:@"SHA-384"]) {
    uint8_t out[CC_SHA384_DIGEST_LENGTH];
    CC_SHA384(bytes, size, out);
    return Base64(out, sizeof(out));
  }
  @throw [NSException exceptionWithName:NSInvalidArgumentException
                                 reason:[NSString stringWithFormat:@"Unsupported digest: %@", algorithm]
                               userInfo:nil];
}

@end
